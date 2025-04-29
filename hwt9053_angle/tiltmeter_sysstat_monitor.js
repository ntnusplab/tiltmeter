const { exec } = require('child_process');
const util = require('util');
const axios = require('axios');

const execAsync = util.promisify(exec);
const SERVER_URL = 'http://<SERVER_IP>:5000/metrics';

async function collectMetrics() {
  let stdout;
  try {
    ({ stdout } = await execAsync('pidstat -u -r -t 1 1'));
  } catch (err) {
    console.error('DEBUG: pidstat 命令执行失败:', err);
    throw err;
  }

  // 过滤空行和 Average 行
  const lines = stdout
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('Average:'));

  // 找 CPU 表头
  const cpuHeaderIndex = lines.findIndex(line => line.includes('%usr'));
  if (cpuHeaderIndex < 0) {
    console.error('DEBUG: 无法找到 CPU 表头');
    throw new Error('无法找到 CPU 表头');
  }
  const cpuHdr = lines[cpuHeaderIndex].trim().split(/\s+/);

  // 收集 CPU 数据行，直到遇到 Memory 表头
  const cpuEntries = [];
  let idx = cpuHeaderIndex + 1;
  while (idx < lines.length && !lines[idx].includes('minflt/s')) {
    const fields = lines[idx].trim().split(/\s+/);
    const obj = {};
    cpuHdr.forEach((h, i) => obj[h] = fields[i]);
    cpuEntries.push(obj);
    idx++;
  }
  // 过滤 subcommand（以 '|__' 开头）
  const filteredCpu = cpuEntries.filter(e => !e.Command.startsWith('|__'));

  // 找 Memory 表头
  const memHeaderIndex = lines.findIndex(line => line.includes('minflt/s'));
  if (memHeaderIndex < 0) {
    console.error('DEBUG: 无法找到 Memory 表头');
    throw new Error('无法找到 Memory 表头');
  }
  const memHdr = lines[memHeaderIndex].trim().split(/\s+/);

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
  // 同样过滤 subcommand
  const filteredMem = memEntries.filter(e => !e.Command.startsWith('|__'));

  // 合并并返回
  return filteredCpu.map(cpu => {
    const key = `${cpu.UID}-${cpu.PID}-${cpu.TID}`;
    const mem = filteredMem.find(m => `${m.UID}-${m.PID}-${m.TID}` === key) || {};
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
  const resp = await axios.post(SERVER_URL, { threads: data }, { timeout: 5000 });
  console.log(`Sent ${data.length} entries, status ${resp.status}`);
}

(async () => {
  try {
    const metrics = await collectMetrics();
    await sendMetrics(metrics);
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
