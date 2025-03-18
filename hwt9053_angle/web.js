const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const app = express();
const http = require('http');
const server = http.createServer(app);
const PORT = 8080;

app.use(express.static('public'));
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
  res.json({ success: true, message: `${key} 更新成功` });
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


// 取得 wwan0 的 IP 位址
function getWWAN0IP(callback) {
  exec('ip addr show wwan0', (error, stdout, stderr) => {
    if (error) {
      return callback(null);
    }
    const match = stdout.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
    if (match) {
      callback(match[1]);
    } else {
      callback(null);
    }
  });
}

// GET /connection-status：從 sys.conf 讀取 IP 與 PORT，檢查連線狀態並取得 wwan0 IP
app.get('/connection-status', (req, res) => {
  let sysConfig = {};
  if (fs.existsSync(sysConfPath)) {
    sysConfig = parseConfig(fs.readFileSync(sysConfPath, 'utf8'));
  }
  const IP = sysConfig.IP;
  const PORT = sysConfig.PORT;

  getWWAN0IP((wwan0IP) => {
    if (!IP || !PORT) {
      return res.json({ connected: false, message: 'sys.conf 中未設定 IP 或 PORT', wwan0IP });
    }
    exec(`nc -z -v ${IP} ${PORT}`, (error, stdout, stderr) => {
      if (error) {
        return res.json({ connected: false, message: '網際網路連線中斷', wwan0IP });
      }
      res.json({ connected: true, message: '網際網路連線正常', wwan0IP });
    });
  });
});

// 新增 API：POST /restart_network 來重新連線網路
app.post('/restart_network', (req, res) => {
  exec('sudo systemctl restart mbim_start_connect.service', (error, stdout, stderr) => {
    if (error) {
      console.error(`restart network error: ${error}`);
      return res.json({ success: false, message: `網路重新連線失敗：${error.message}` });
    }
    res.json({ success: true, message: '網路已重新連線' });
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
