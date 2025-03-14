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

// 檔案路徑：sys.conf 位於上一層；.env 與 .config.json 位於本層
const sysConfPath = path.join(__dirname, '..', 'sys.conf');
const envPath = path.join(__dirname, '.env');
const combinedConfigPath = path.join(__dirname, '.config.json');

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

// 輔助函數：將物件轉成 key=value 格式字串
function generateConfigContent(configObj) {
  let content = "";
  for (const key in configObj) {
    content += `${key}=${configObj[key]}\n`;
  }
  return content;
}

// 產生扁平化設定：合併 sys.conf 與 .env
function generateFlatConfig() {
  let sysConfig = {};
  let envConfig = {};
  if (fs.existsSync(sysConfPath)) {
    const sysContent = fs.readFileSync(sysConfPath, 'utf8');
    sysConfig = parseConfig(sysContent);
  }
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envConfig = parseConfig(envContent);
  }
  // 假設兩邊的 key 不會重複
  return { ...sysConfig, ...envConfig };
}

// 更新隱藏的 .config.json 檔案
function updateCombinedConfigFile(flatConfig) {
  fs.writeFileSync(combinedConfigPath, JSON.stringify(flatConfig, null, 2), 'utf8');
}

function getWWAN0IP(callback) {
  exec('ip addr show wwan0', (error, stdout, stderr) => {
    if (error) {
      // 若指令執行錯誤，回傳 null
      return callback(null);
    }
    // 使用正則表達式找出 "inet <IP>" 部分
    const match = stdout.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
    if (match) {
      callback(match[1]);
    } else {
      callback(null);
    }
  });
}

// GET /config-json：回傳扁平化設定並更新 .config.json
app.get('/config-json', (req, res) => {
  const flatConfig = generateFlatConfig();
  updateCombinedConfigFile(flatConfig);
  res.json(flatConfig);
});

// POST /update-all-config：接收 { configData }，依據每個 key 更新原始檔案
app.post('/update-all-config', (req, res) => {
  const { configData } = req.body;
  if (!configData || typeof configData !== 'object') {
    return res.status(400).json({ error: '未提供正確的 configData' });
  }
  // 讀取原始檔案
  let sysConfig = {};
  let envConfig = {};
  if (fs.existsSync(sysConfPath)) {
    sysConfig = parseConfig(fs.readFileSync(sysConfPath, 'utf8'));
  }
  if (fs.existsSync(envPath)) {
    envConfig = parseConfig(fs.readFileSync(envPath, 'utf8'));
  }
  // 根據原本出現的檔案更新對應的 key；不存在則預設新增到 .env
  for (let key in configData) {
    if (sysConfig.hasOwnProperty(key)) {
      sysConfig[key] = configData[key];
    } else {
      envConfig[key] = configData[key];
    }
  }
  fs.writeFileSync(sysConfPath, generateConfigContent(sysConfig), 'utf8');
  fs.writeFileSync(envPath, generateConfigContent(envConfig), 'utf8');

  const flatConfig = { ...sysConfig, ...envConfig };
  updateCombinedConfigFile(flatConfig);
  res.json({ success: true, message: '設定檔更新成功' });
});

// GET /connection-status：從 sys.conf 讀取 IP 與 PORT，執行 nc 指令檢查連線，並使用 exec 取得 wwan0 的 IP
app.get('/connection-status', (req, res) => {
  let sysConfig = {};
  if (fs.existsSync(sysConfPath)) {
    const content = fs.readFileSync(sysConfPath, 'utf8');
    sysConfig = parseConfig(content);
  }
  const IP = sysConfig.IP;
  const PORT = sysConfig.PORT;

  // 先取得 wwan0 的 IP
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

// 啟動伺服器
server.listen(PORT, () => {
  console.log(`伺服器已啟動，請訪問 http://localhost:${PORT}`);
});
