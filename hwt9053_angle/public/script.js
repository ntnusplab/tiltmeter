'use strict';

let flatConfig = {};

// 控制設定，決定哪些項目隱藏、唯讀或可修改
const dropdownConfig = {
  hiddenKeys: ['SERIALPORT_PATH', 'BACKUP_TCP_TEST', 'API_URL'],
  readOnlyKeys: ['DEVICE_ID'],
  options: [
    { key: 'APN', label: 'APN' },
    { key: 'API_URL', label: '後端資料API位置' },
    { key: 'BACKUP_TCP_HOST', label: '備份TCP傳輸IP地址' },
    { key: 'BACKUP_TCP_PORT', label: '備份TCP傳輸PORT' },
    { key: 'DEVICE_ID', label: '設備編號' },
    { key: 'BACKUP_TCP_TEST', label: '啟用備份資料夾測試' },
    { key: 'MIN_SAMPLE_RATE', label: '最小資料傳輸週期(秒)' },
    { key: 'SAMPLE_RATE', label: '資料傳輸週期(秒)' },
    { key: 'ANGLE_DIFFERENT_THERSHOLD', label: '角度警報域值' },
    { key: 'SERIALPORT_PATH', label: 'RS485接口' },
  ]
};

// 登入功能：點擊按鈕或在密碼欄按 Enter 時觸發
document.getElementById('loginButton').addEventListener('click', login);
document.getElementById('password').addEventListener('keyup', function (e) {
  if (e.key === 'Enter') login();
});

function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        document.getElementById('loginDiv').style.display = 'none';
        document.getElementById('configEditor').style.display = 'block';
        loadConfig();
        checkConnectionStatus();
      } else {
        document.getElementById('loginMessage').innerText = data.message || '登入失敗';
      }
    })
    .catch(err => console.error('Error:', err));
}

// 讀取後端設定資料，並整合 sys 與 env（若同一 key 同時存在，以 sys 優先）
function loadConfig() {
  return fetch('/config-json')                // ← 加上 return
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      flatConfig = {};
      Object.assign(flatConfig, data.env, data.sys);
      populateConfigControls(flatConfig, dropdownConfig);
      return flatConfig;                      // ← （可選）回傳給下游使用
    })
    .catch(err => {
      console.error('loadConfig 失敗：', err);
      throw err;                               // ← 讓呼叫端也能抓到錯誤
    });
}


// 根據後端取得的設定與控制設定，分別建立唯讀與可修改項目
function populateConfigControls(configJson, controlConfig) {
  const container = document.getElementById('configContainer');
  container.innerHTML = '';
  const hiddenKeys = controlConfig.hiddenKeys || [];
  const readOnlyKeys = controlConfig.readOnlyKeys || [];
  const options = controlConfig.options || [];

  // 建立唯讀區塊
  const readonlyDiv = document.createElement('div');
  const readonlyHeader = document.createElement('h4');
  // readonlyHeader.innerText = "唯讀內容";
  readonlyDiv.appendChild(readonlyHeader);

  // 建立可修改區塊
  const editableDiv = document.createElement('div');
  const editableHeader = document.createElement('h4');
  editableHeader.innerText = "可修改設定";
  editableDiv.appendChild(editableHeader);

  options.forEach(item => {
    if (hiddenKeys.includes(item.key)) return;
    const div = document.createElement('div');
    div.className = 'config-item';
    const label = document.createElement('span');
    label.className = 'config-key';
    label.textContent = item.label + ': ';
    div.appendChild(label);
    if (readOnlyKeys.includes(item.key)) {
      const valueSpan = document.createElement('span');
      valueSpan.className = 'config-value';
      valueSpan.textContent = configJson[item.key] || '';
      div.appendChild(valueSpan);
      readonlyDiv.appendChild(div);
    } else {
      const input = document.createElement('input');
      input.className = 'config-value';
      input.type = 'text';
      input.value = configJson[item.key] || '';
      input.dataset.key = item.value;
      div.appendChild(input);
      // 為每個可修改項目增加一個修改按鈕
      const btn = document.createElement('button');
      btn.className = 'btn btn-sm btn-primary ms-2';
      btn.innerText = '修改設定';
      btn.addEventListener('click', function () {
        updateConfig(item.key, input.value);
      });
      div.appendChild(btn);
      editableDiv.appendChild(div);
    }
  });
  container.appendChild(readonlyDiv);
  container.appendChild(document.createElement('hr'));
  container.appendChild(editableDiv);
}

// 呼叫後端單一更新 API，更新單個項目
function updateConfig(key, value) {
  fetch('/update-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value })
  })
    .then(res => res.json())
    .then(data => {
      alert(data.message || '更新成功');
      // loadConfig();
    })
    .catch(err => console.error('Error:', err));
}


// 檢查網際網路連線狀況
async function checkConnectionStatus() {
  console.log('checkConnectionStatus() 被呼叫');

  const statusEl = document.getElementById('connectionStatus');
  const host = flatConfig.BACKUP_TCP_HOST;
  const port = flatConfig.BACKUP_TCP_PORT;

  if (!host || !port) {
    statusEl.innerText = '請先在「可修改設定」中填寫備份 TCP 傳輸的 HOST 與 PORT';
    statusEl.style.color = 'red';
    return;
  }

  try {
    const res = await fetch('/connection-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ IP: host, PORT: port })
    });

    console.log('fetch 完成，HTTP 狀態：', res.status);
    const text = await res.text();
    console.log('原始回應文字：', text);

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`非 JSON 回應：${text}`);
    }

    if (!res.ok) {
      throw new Error(data.message || `HTTP ${res.status}`);
    }

    console.log('解析後 JSON：', data);
    let msg = data.message || '未知狀態';
    if (data.wwan0IP) {
      msg += ` (WWAN IP: ${data.wwan0IP})`;
    }
    statusEl.innerText = msg;
    statusEl.style.color = data.connected ? 'green' : 'red';

  } catch (err) {
    console.error('checkConnectionStatus 發生錯誤：', err);
    statusEl.innerText = `連線檢查錯誤：${err.message}`;
    statusEl.style.color = 'red';
  }
}

// DOM 載入後再綁事件、讀取設定與啟動檢查
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('refreshConnectionBtn')
    .addEventListener('click', checkConnectionStatus);
  document.getElementById('refreshConfigBtn')
    .addEventListener('click', () => {
      loadConfig().then(checkConnectionStatus);
    });

  // 第一次載入時，同步讀設定並檢查
  loadConfig().then(checkConnectionStatus);

  // 每 10 秒自動檢查一次
  setInterval(checkConnectionStatus, 10000);
});

// 新增重新開機按鈕事件，呼叫 /restart_tiltmeter API
document.getElementById('restartTiltmeterBtn').addEventListener('click', function () {
  if (confirm("確認要重新開機系統嗎？")) {
    fetch('/restart_tiltmeter', {
      method: 'POST'
    })
      .then(res => res.json())
      .then(data => {
        alert(data.message);
      })
      .catch(err => console.error('Error:', err));
  }
});

// 新增重新連線網路按鈕事件
document.getElementById('restartNetworkBtn').addEventListener('click', function () {
  if (confirm("確認要重新連線網路嗎？")) {
    fetch('/restart_network', {
      method: 'POST'
    })
      .then(res => res.json())
      .then(data => {
        alert(data.message);
      })
      .catch(err => console.error('Error:', err));
  }
});
// 新增重啟感測器按鈕事件
document.getElementById('restartSensorBtn').addEventListener('click', function () {
  if (confirm("確認要重啟感測器嗎？")) {
    fetch('/restart_sensor', {
      method: 'POST'
    })
      .then(res => res.json())
      .then(data => {
        alert(data.message);
      })
      .catch(err => console.error('Error:', err));
  }
});
