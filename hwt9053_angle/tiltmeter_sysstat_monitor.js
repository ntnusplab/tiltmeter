// ==============================
// CLIENT: thread_report.js (with improved header detection)
// ==============================
// 安装依赖：
//   sudo apt update
//   sudo apt install -y sysstat nodejs npm
//   npm install axios
// 替换 SERVER_URL 为你的服务器地址（如 http://192.168.1.100:5000/metrics）

#!/usr/bin/env node
const { exec } = require('child_process');
const util = require('util');
const axios = require('axios');

const execAsync = util.promisify(exec);
const SERVER_URL = 'http://<SERVER_IP>:5000/metrics';

async function collectMetrics() {
  // 执行 pidstat 并获取原始输出
  let stdout;
  try {
    ({ stdout } = await execAsync('pidstat -u -r -t 1 1'));
  } catch (err) {
    console.error('DEBUG: pidstat 命令执行失败:', err);
    throw err;
  }

  console.log('DEBUG: raw pidstat stdout:\n' + stdout);

  // 分割行并过滤
  const lines = stdout
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('Average:'));
  console.log('DEBUG: parsed lines count =', lines.length);

  // 找 CPU 表头：包含 "%usr" 列的那一行
  const cpuHeaderIndex = lines.findIndex(line => line.includes('%usr'));
  console.log('DEBUG: cpuHeaderIndex =', cpuHeaderIndex);
  if (cpuHeaderIndex < 0) {
    console.error('DEBUG: 无法找到 CPU 表头，以下是所有行：');
    lines.forEach((l, i) => console.error(i, l));
    throw new Error('无法找到 CPU 表头');
  }

  const cpuHdr = lines[cpuHeaderIndex].trim().split(/\s+/);
  console.log('DEBUG: CPU header =', cpuHdr);

  // 收集 CPU 数据行
  const cpuEntries = [];
  let idx = cpuHeaderIndex + 1;
  while (idx < lines.length && lines[idx].trim() && !lines[idx].includes('minflt/s')) {
    const fields = lines[idx].trim().split(/\s+/);
    const obj = {};
    cpuHdr.forEach((h, i) => obj[h] = fields[i]);
    cpuEntries.push(obj);
    idx++;
  }
  console.log('DEBUG: cpuEntries count =', cpuEntries.length);

  // 找 Memory 表头
  const memHeaderIndex = lines.findIndex(line => line.includes('minflt/s'));
  console.log('DEBUG: memHeaderIndex =', memHeaderIndex);
  if (memHeaderIndex < 0) {
    console.error('DEBUG: 无法找到 Memory 表头，以下是所有行：');
    lines.forEach((l, i) => console.error(i, l));
    throw new Error('无法找到 Memory 表头');
  }
  const memHdr = lines[memHeaderIndex].trim().split(/\s+/);
  console.log('DEBUG: Memory header =', memHdr);

  // 收集 Memory 数据行
  const memEntries = [];
  idx = memHeaderIndex + 1;
  while (idx < lines.length && lines[idx].trim()) {
    const fields = lines[idx].trim().split(/\s+/);
    const obj = {};
    memHdr.forEach((h, i) => obj[h] = fields[i]);
    memEntries.push(obj);
    idx++;
  }
  console.log('DEBUG: memEntries count =', memEntries.length);

  // 合并 CPU & Memory 数据
  const metrics = cpuEntries.map(cpu => {
    const key = `${cpu.UID}-${cpu.PID}-${cpu.TID}`;
    const mem = memEntries.find(m => `${m.UID}-${m.PID}-${m.TID}` === key) || {};
    return {
      timestamp: new Date().toISOString(),
      uid: cpu.UID,
      pid: cpu.PID,
      tid: cpu.TID,
      command: cpu.Command,
      cpu_usr: cpu['%usr'],
      cpu_system: cpu['%system'],
      cpu_guest: cpu['%guest'],
      cpu_wait: cpu['%wait'],
      cpu_total: cpu['%CPU'],
      cpu_core: cpu.CPU,
      minflt_per_s: mem['minflt/s'],
      majflt_per_s: mem['majflt/s'],
      vsz_kb: mem.VSZ,
      rss_kb: mem.RSS,
      mem_percent: mem['%MEM']
    };
  });

  console.log('DEBUG: final metrics count =', metrics.length);
  return metrics;
}

async function sendMetrics(data) {
  try {
    const resp = await axios.post(SERVER_URL, { threads: data }, { timeout: 5000 });
    console.log('DEBUG: POST response status =', resp.status);
  } catch (err) {
    console.error('DEBUG: POST 失败:', err.message);
    throw err;
  }
}

async function main() {
  try {
    console.log('DEBUG: collectMetrics start');
    const metrics = await collectMetrics();
    console.log('DEBUG: sendMetrics start');
    await sendMetrics(metrics);
    console.log(`Sent ${metrics.length} entries`);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
