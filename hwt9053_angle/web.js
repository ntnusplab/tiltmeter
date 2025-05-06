'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const app = express();
const http = require('http');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const server = http.createServer(app);
const PORT = 8080;
const os = require('os');

app.use(express.static('public'));
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 簡單的登入驗證（示範用）
const user = { username: 'admin', password: '28579684' };
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === user.username && password === user.password) {
    res.json({ success: true });
  } else {
    res.json({ success: false, message: '帳號或密碼錯誤' });
  }
});

// 檔案路徑設定：sys.conf 位於上一層，.env 位於本層
const sysConfPath = path.join(__dirname, '..', 'sys.conf');
const envPath = path.join(__dirname, '.env');

// 輔助函數：解析 key=value 格式的文字
function parseConfig(content) {
  const config = {};
  content.split('\n').forEach(line => {
    line = line.trim();
    if (line && line.indexOf('=') !== -1 && line.charAt(0) !== '#') {
      const parts = line.split('=');
      const key = parts.shift().trim();
      const value = parts.join('=').trim();
      config[key] = value;
    }
  });
  return config;
}

// 輔助函數：將物件轉成 key=value 格式的字串
function generateConfigContent(configObj) {
  let content = "";
  for (const key in configObj) {
    content += `${key}=${configObj[key]}\n`;
  }
  return content;
}

// GET /config-json：讀取各自的設定檔，不再合併
app.get('/config-json', (req, res) => {
  let sysConfig = {};
  let envConfig = {};
  if (fs.existsSync(sysConfPath)) {
    sysConfig = parseConfig(fs.readFileSync(sysConfPath, 'utf8'));
  }
  if (fs.existsSync(envPath)) {
    envConfig = parseConfig(fs.readFileSync(envPath, 'utf8'));
  }
  res.json({ sys: sysConfig, env: envConfig });
});

// POST /update-config：針對單一 key 更新設定（不再自動重啟 pm2）
app.post('/update-config', (req, res) => {
  const { key, value } = req.body;
  if (!key) {
    return res.status(400).json({ error: '未提供 key' });
  }
  let sysConfig = {};
  let envConfig = {};
  if (fs.existsSync(sysConfPath)) {
    sysConfig = parseConfig(fs.readFileSync(sysConfPath, 'utf8'));
  }
  if (fs.existsSync(envPath)) {
    envConfig = parseConfig(fs.readFileSync(envPath, 'utf8'));
  }
  // 若 key 存在於 sys.conf 中則更新 sys，否則預設更新到 .env
  if (sysConfig.hasOwnProperty(key)) {
    sysConfig[key] = value;
  } else {
    envConfig[key] = value;
  }
  fs.writeFileSync(sysConfPath, generateConfigContent(sysConfig), 'utf8');
  fs.writeFileSync(envPath, generateConfigContent(envConfig), 'utf8');
  res.json({ success: true, message: ` 更新成功` });
});

// 新增 API：POST /restart_tiltmeter 來重新開機系統
app.post('/restart_tiltmeter', (req, res) => {
  exec('sudo reboot', (error, stdout, stderr) => {
    if (error) {
      console.error(`reboot error: ${error}`);
      return res.json({ success: false, message: `系統重啟失敗：${error.message}` });
    }
    res.json({ success: true, message: '系統已重新開機' });
  });
});

// 1. 取得 eth0 上真正從 4G 模組那邊透過 NAS/DHCP NAT 分來的 IP
function getETH0IP() {
  const nets = os.networkInterfaces();
  const eth0 = nets['eth0'] || [];
  for (const addr of eth0) {
    if (addr.family === 'IPv4' && !addr.internal) {
      return Promise.resolve(addr.address);
    }
  }
  // 如果 eth0 沒拿到，再掃描其他介面
  for (const name of Object.keys(nets)) {
    for (const addr of nets[name]) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return Promise.resolve(addr.address);
      }
    }
  }
  return Promise.resolve(null);
}

// 2. POST /connection-status: 從 body 拿 IP/PORT，ping 遠端、回傳 eth0IP
app.post('/connection-status', async (req, res) => {
  const { IP, PORT } = req.body;
  if (!IP || !PORT) {
    return res.status(400).json({
      connected: false,
      message: '請提供 IP 與 PORT'
    });
  }

  const eth0IP = await getETH0IP();
  if (!eth0IP) {
    return res.status(500).json({
      connected: false,
      message: '無法取得 eth0 IP'
    });
  }

  exec(`nc -z -v ${IP} ${PORT}`, (err) => {
    if (err) {
      return res.json({
        connected: false,
        message: '與遠端主機連線失敗',
        eth0IP
      });
    }
    res.json({
      connected: true,
      message: '連線測試成功',
      eth0IP
    });
  });
});

// 3. POST /restart_network: 執行 ../mbim_start_connect.sh 並回傳完整日誌
app.post('/restart_network', (req, res) => {
  const scriptPath = path.join(__dirname, '..', 'mbim_start_connect.sh');
  const proc = spawn('bash', [scriptPath]);
  let log = '';

  proc.stdout.on('data', data => log += data.toString());
  proc.stderr.on('data', data => log += data.toString());

  proc.on('close', code => {
    if (code !== 0) {
      return res.status(500).json({
        success: false,
        message: `腳本執行失敗 (code=${code})`,
        output: log.trim()
      });
    }
    res.json({
      success: true,
      message: '4G 模組 APN 已更新並重新啟動',
      output: log.trim()
    });
  });
});

// 新增 API：POST /restart_sensor 來重啟感測器
app.post('/restart_sensor', (req, res) => {

  exec('sudo pm2 restart tiltmeter', (error, stdout, stderr) => {
    if (error) {
      console.error(`restart sensor error: ${error}`);
      return res.json({ success: false, message: `重啟感測器失敗：${error.message}` });
    }
    res.json({ success: true, message: '感測器已重啟' });
  });
});

app.get('/server-time', (req, res) => {
  res.json({
    time: new Date().toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  });
});

server.listen(PORT, () => {
  console.log(`伺服器已啟動，請訪問 http://localhost:${PORT}`);
});
