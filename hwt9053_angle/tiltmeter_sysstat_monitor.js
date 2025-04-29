const { exec } = require('child_process');
const util = require('util');
const axios = require('axios');

const execAsync = util.promisify(exec);
// 发送目标地址
const SERVER_URL = 'http://192.168.50.124:8088/metrics';

async function collectMetrics() {
  // 列出所有线程并采样一次 CPU 和内存
  const { stdout } = await execAsync('pidstat -u -r -t -p ALL 1 1');

  const lines = stdout
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('Average:'));

  // 找到 CPU 表头行
  const cpuHeaderIndex = lines.findIndex(line => line.includes('%usr'));
  if (cpuHeaderIndex < 0) throw new Error('无法找到 CPU 表头');
  const cpuHdr = lines[cpuHeaderIndex].trim().split(/\s+/);

  // 解析 CPU 数据直到 Memory 表头
  const cpuEntries = [];
  let idx = cpuHeaderIndex + 1;
  while (idx < lines.length && !lines[idx].includes('minflt/s')) {
    const fields = lines[idx].trim().split(/\s+/);
    const entry = {};
    cpuHdr.forEach((h, i) => entry[h] = fields[i]);
    cpuEntries.push(entry);
    idx++;
  }
  // 过滤子线程，仅保留主线程
  const mainThreads = cpuEntries.filter(e => !e.Command.startsWith('|__'));

  // 找到 Memory 表头
  const memHeaderIndex = lines.findIndex(line => line.includes('minflt/s'));
  if (memHeaderIndex < 0) throw new Error('无法找到 Memory 表头');
  const memHdr = lines[memHeaderIndex].trim().split(/\s+/);

  // 解析 Memory 数据
  const memEntries = [];
  idx = memHeaderIndex + 1;
  while (idx < lines.length && lines[idx].trim()) {
    const fields = lines[idx].trim().split(/\s+/);
    const entry = {};
    memHdr.forEach((h, i) => entry[h] = fields[i]);
    memEntries.push(entry);
    idx++;
  }
  // 过滤子线程
  const mainMem = memEntries.filter(e => !e.Command.startsWith('|__'));

  // 合并为 {command: metrics} 结构
  const data = {};
  for (const cpu of mainThreads) {
    const key = `${cpu.UID}-${cpu.PID}-${cpu.TID}`;
    const mem = mainMem.find(m => `${m.UID}-${m.PID}-${m.TID}` === key) || {};
    data[cpu.Command] = {
      cpu_usr: cpu['%usr'],
      cpu_system: cpu['%system'],
      cpu_guest: cpu['%guest'],
      cpu_wait: cpu['%wait'],
      cpu_total: cpu['%CPU'],
      cpu_core: cpu.CPU,
      vsz_kb: mem.VSZ,
      rss_kb: mem.RSS,
      mem_percent: mem['%MEM']
    };
  }

  return data;
}

async function runOnce() {
  try {
    const data = await collectMetrics();
    const report = {
      time: new Date().toISOString(),
      data
    };
    // 打印并 POST
    console.log(JSON.stringify(report, null, 2));
    await axios.post(SERVER_URL, report);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

function scheduleNext() {
  const now = new Date();
  const next = new Date(now);
  next.setMinutes(now.getMinutes() + 1, 0, 0);
  const delayMs = next - now;
  setTimeout(async () => {
    await runOnce();
    scheduleNext();
  }, delayMs);
}

// 初始执行，并在每分钟整点重复
runOnce();
scheduleNext();
