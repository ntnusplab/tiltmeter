'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const app = express();
const http = require('http');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
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


// // 取得 wwan0 的 IP 位址
// function getETH0IP(callback) {
//   exec('ip addr show eth0', (error, stdout, stderr) => {
//     if (error) {
//       return callback(null);
//     }
//     const match = stdout.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
//     if (match) {
//       callback(match[1]);
//     } else {
//       callback(null);
//     }
//   });
// }

function getWWAN0IP(callback) {
  const tty = '/dev/ttyUSB2';  // AT 控制埠
  const port = new SerialPort({
    path: tty,
    baudRate: 115200,
    autoOpen: false,
  });

  let done = false;
  const onDone = ip => {
    if (done) return;
    done = true;
    try { port.close(); } catch {} 
    callback(ip);
  };

  port.open(err => {
    if (err) {
      console.error('開啟序列埠失敗：', err.message);
      return onDone(null);
    }

    const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
    parser.on('data', line => {
      // 如果你想除錯，可以先打出所有回傳：
      // console.log('<<', line);
      const m = line.match(/\+CGPADDR:\s*\d+,"?(\d+\.\d+\.\d+\.\d+)"?/);
      if (m) {
        onDone(m[1]);
      }
    });

    // 清空任何殘留資料，再送指令
    port.flush(flushErr => {
      if (flushErr) {
        console.warn('flush 失敗，繼續寫指令');
      }
      port.write('AT+CGPADDR=1\r', writeErr => {
        if (writeErr) {
          console.error('送出 AT 指令失敗：', writeErr.message);
          onDone(null);
        }
      });
    });

    // 2 秒後若沒回應，就收尾
    setTimeout(() => onDone(null), 2000);
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


app.post('/restart_network', (req, res) => {
  const portPath   = '/dev/ttyUSB2';    // 請確認你的 AT 控制埠
  const baudRate   = 115200;
  const atCommand  = 'AT+CFUN=1,1';
  let responseSent = false;

  // 幫你安全關埠
  function safeClosePort(port) {
    if (port.isOpen) {
      port.close(err => {
        if (err && err.message !== 'Port is not open')
          console.error('關閉序列埠錯誤:', err.message);
      });
    }
  }

  // 打開串口但不馬上發回 HTTP
  const port = new SerialPort({
    path: portPath,
    baudRate,
    autoOpen: false
  });

  const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

  // 當 parser 收到一行
  parser.on('data', line => {
    console.log('<< 4G 回應:', line);
    if (responseSent) return;

    // 如果看到了 OK，就認定重啟指令下達成功
    if (/^OK$/i.test(line.trim())) {
      responseSent = true;
      res.json({ success: true, message: '已向 4G 模組發送重啟指令' });
      safeClosePort(port);
    }
  });

  // 開不到就直接回錯誤
  port.open(err => {
    if (err) {
      console.error('開啟序列埠失敗:', err.message);
      if (!responseSent) {
        responseSent = true;
        return res.json({ success: false, message: `開啟串口失敗：${err.message}` });
      }
    }

    // 清掉舊資料
    port.flush(flushErr => {
      if (flushErr) console.warn('flush 錯誤，繼續。');

      // 送出指令
      console.log('>> 送出重啟指令:', atCommand);
      port.write(atCommand + '\r', writeErr => {
        if (writeErr && !responseSent) {
          console.error('串口寫入失敗:', writeErr.message);
          responseSent = true;
          res.json({ success: false, message: `AT 指令下發失敗：${writeErr.message}` });
          safeClosePort(port);
        }
      });
    });
  });

  // 5 秒後若都沒收到 OK，就 timeout
  setTimeout(() => {
    if (!responseSent) {
      responseSent = true;
      console.warn('等待 AT 回應超時');
      res.json({ success: false, message: '4G 模組無回應 (AT 超時)' });
      safeClosePort(port);
    }
  }, 30000);
});

// app.post('/restart_network', (req, res) => {
//   const portPath = '/dev/ttyUSB2'; // 根據你的實際連接埠調整
//   const baudRate = 115200;
//   const atCommand = 'AT+CFUN=1,1';

//   // 開啟串口
//   const port = new SerialPort({ path: portPath, baudRate: baudRate }, (err) => {
//     if (err) {
//       console.error(`Error opening serial port: ${err.message}`);
//       return res.json({ success: false, message: `開啟串口失敗：${err.message}` });
//     }
//   });

//   const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
//   let responseSent = false;

//   // 定義一個關閉串口的函式，檢查是否開啟中
//   function safeClosePort() {
//     if (port.isOpen) {
//       port.close((err) => {
//         if (err && err.message !== 'Port is not open') {
//           console.error(`Closing port error: ${err.message}`);
//         }
//       });
//     }
//   }

//   // 設定 5 秒超時機制，如果在 5 秒內未收到 AT 指令回應，就嘗試關閉串口
//   const atTimeout = setTimeout(() => {
//     if (!responseSent) {
//       console.warn('5秒內未收到AT指令回應，嘗試關閉串口');
//       safeClosePort();
//     }
//   }, 5000);

//   // 監聽串口回應
//   parser.on('data', (data) => {
//     console.log(`Received response: ${data}`);
//     if (!responseSent) {
//       clearTimeout(atTimeout);
//       res.json({ success: true, message: '4G 模組已發送重啟指令' });
//       responseSent = true;
//       safeClosePort();
//     }
//   });

//   // 當串口開啟後，發送 AT 指令
//   port.on('open', () => {
//     console.log(`Sending command: ${atCommand}`);
//     port.write(atCommand + '\r\n', (err) => {
//       if (err) {
//         console.error(`Error writing to serial port: ${err.message}`);
//         if (!responseSent) {
//           clearTimeout(atTimeout);
//           res.json({ success: false, message: `發送 AT 指令失敗：${err.message}` });
//           responseSent = true;
//         }
//         safeClosePort();
//       }
//     });
//   });

//   // 監聽錯誤事件
//   port.on('error', (err) => {
//     console.error(`Serial port error: ${err.message}`);
//     if (!responseSent) {
//       clearTimeout(atTimeout);
//       res.json({ success: false, message: `串口錯誤：${err.message}` });
//       responseSent = true;
//     }
//     safeClosePort();
//   });

//   // 延遲 30 秒後執行 exec 指令重啟網路
//   setTimeout(() => {
//     exec('sudo systemctl restart mbim_start_connect.service', (error, stdout, stderr) => {
//       if (error) {
//         console.error(`restart network error: ${error}`);
//         if (!responseSent) {
//           res.json({ success: false, message: `網路重新連線失敗：${error.message}` });
//           responseSent = true;
//         }
//         return;
//       }
//       if (!responseSent) {
//         res.json({ success: true, message: '網路已重新連線' });
//         responseSent = true;
//       }
//     });
//   }, 30000); // 可根據需求調整延遲時間
// });

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
