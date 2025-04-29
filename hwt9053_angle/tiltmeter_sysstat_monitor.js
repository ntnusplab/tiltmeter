const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

async function collectMetrics() {
  let stdout;
  try {
    // 使用 -p ALL 确保列出所有线程
    ({ stdout } = await execAsync('pidstat -u -r -t -p ALL 1 1'));
  } catch (err) {
    console.error('Error: pidstat 执行失败:', err);
    throw err;
  }

  const lines = stdout
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('Average:'));

  // 找到包含 %usr 的 CPU 表头
  const cpuHeaderIndex = lines.findIndex(line => line.includes('%usr'));
  if (cpuHeaderIndex < 0) throw new Error('无法找到 CPU 表头');
  const cpuHdr = lines[cpuHeaderIndex].trim().split(/\s+/);

  // 解析 CPU 数据行，直到遇到 Memory 表头
  const cpuEntries = [];
  let idx = cpuHeaderIndex + 1;
  while (idx < lines.length && !lines[idx].includes('minflt/s')) {
    const fields = lines[idx].trim().split(/\s+/);
    const entry = {};
    cpuHdr.forEach((h, i) => entry[h] = fields[i]);
    cpuEntries.push(entry);
    idx++;
  }
  // 过滤子命令行
  const filteredCpu = cpuEntries.filter(e => !e.Command.startsWith('|__'));

  // 找 Memory 表头
  const memHeaderIndex = lines.findIndex(line => line.includes('minflt/s'));
  if (memHeaderIndex < 0) throw new Error('无法找到 Memory 表头');
  const memHdr = lines[memHeaderIndex].trim().split(/\s+/);

  // 解析 Memory 数据行
  const memEntries = [];
  idx = memHeaderIndex + 1;
  while (idx < lines.length && lines[idx].trim()) {
    const fields = lines[idx].trim().split(/\s+/);
    const entry = {};
    memHdr.forEach((h, i) => entry[h] = fields[i]);
    memEntries.push(entry);
    idx++;
  }
  const filteredMem = memEntries.filter(e => !e.Command.startsWith('|__'));

  // 合并并返回 JSON 数组
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

async function runOnce() {
  try {
    const threads = await collectMetrics();
    console.log(JSON.stringify(threads, null, 2));
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

// 初始执行，并准点每分钟重复
runOnce();
scheduleNext();
