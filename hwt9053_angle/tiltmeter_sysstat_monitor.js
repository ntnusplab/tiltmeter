const { exec } = require('child_process');
const util = require('util');
const axios = require('axios');

const execAsync = util.promisify(exec);
const SERVER_URL = 'http://<SERVER_IP>:5000/metrics';

async function collectMetrics() {
  const { stdout } = await execAsync('pidstat -u -r -t 1 1');
  const lines = stdout
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('Average:'));  // 去掉空行和 Average

  // 找 CPU 表头
  const cpuHeaderIndex = lines.findIndex(line => line.trim().startsWith('UID'));
  if (cpuHeaderIndex < 0) throw new Error('无法找到 CPU 表头');
  const cpuHdr = lines[cpuHeaderIndex].trim().split(/\s+/);
  const cpuEntries = [];
  let idx = cpuHeaderIndex + 1;
  while (idx < lines.length && lines[idx].trim() && !lines[idx].includes('minflt/s')) {
    const fields = lines[idx].trim().split(/\s+/);
    const obj = {};
    cpuHdr.forEach((h, i) => obj[h] = fields[i]);
    cpuEntries.push(obj);
    idx++;
  }

  // 找 mem 表头
  const memHeaderIndex = lines.findIndex(line => line.includes('minflt/s'));
  if (memHeaderIndex < 0) throw new Error('无法找到 Memory 表头');
  const memHdr = lines[memHeaderIndex].trim().split(/\s+/);
  const memEntries = [];
  idx = memHeaderIndex + 1;
  while (idx < lines.length && lines[idx].trim()) {
    const fields = lines[idx].trim().split(/\s+/);
    const obj = {};
    memHdr.forEach((h, i) => obj[h] = fields[i]);
    memEntries.push(obj);
    idx++;
  }

  // 合并数据
  return cpuEntries.map(cpu => {
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
}

async function sendMetrics(data) {
  await axios.post(SERVER_URL, { threads: data }, { timeout: 5000 });
}

async function main() {
  try {
    const metrics = await collectMetrics();
    await sendMetrics(metrics);
    console.log(`Sent ${metrics.length} entries`);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();