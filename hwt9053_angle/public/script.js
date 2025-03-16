let flatConfig = {};

// 登入功能：點擊按鈕或在密碼欄按 Enter 觸發
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
        checkConnectionStatus(); // 登入後立即檢查一次連線狀況
      } else {
        document.getElementById('loginMessage').innerText = data.message || '登入失敗';
      }
    })
    .catch(err => console.error('Error:', err));
}

// 讀取後端設定資料，並根據控制設定建立畫面
function loadConfig() {
  fetch('/config-json')
    .then(res => res.json())
    .then(data => {
      flatConfig = data;
      // 傳入取得的設定資料 flatConfig 與用來控制顯示內容的 dropdownConfig
      populateConfigControls(flatConfig, dropdownConfig);
    })
    .catch(err => console.error('Error:', err));
}

// 用來控制顯示內容的設定
const dropdownConfig = {
  hiddenKeys: ['SERIALPORT_PATH', 'BACKUP_TCP_TEST', 'API_URL'], // 隱藏的選項
  readOnlyKeys: ['DEVICE_ID'],                                   // 唯讀（靜態顯示）的選項
  options: [
    { key: 'API_URL', label: '後端資料API位置' },
    { key: 'BACKUP_TCP_HOST', label: '備份TCP傳輸IP地址' },
    { key: 'BACKUP_TCP_PORT', label: '備份TCP傳輸PORT' },
    { key: 'DEVICE_ID', label: '設備編號' },
    { key: 'BACKUP_TCP_TEST', label: '啟用備份資料夾測試' },
    { key: 'SAMPLE_RATE', label: '資料傳輸週期(秒)' },
    { key: 'SERIALPORT_PATH', label: 'RS485接口' },
  ]
};

/**
 * 根據後端設定資料（configJson）與控制設定（controlConfig），
 * 將不在 hiddenKeys 裡的選項依序列出：
 *  - 若屬於 readOnlyKeys，則以靜態方式呈現（不可編輯）
 *  - 其他則顯示為可編輯的文字欄位，並預設填入對應的 value
 */
function populateConfigControls(configJson, controlConfig) {
  const container = document.getElementById('configContainer');
  container.innerHTML = ''; // 清空舊內容

  const hiddenKeys = controlConfig.hiddenKeys || [];
  const readOnlyKeys = controlConfig.readOnlyKeys || [];
  const options = controlConfig.options || [];

  options.forEach(item => {
    // 只處理不在 hiddenKeys 的項目
    if (hiddenKeys.includes(item.key)) return;

    // 建立每個項目的容器
    const div = document.createElement('div');
    div.className = 'config-item';

    // 建立標籤
    const label = document.createElement('span');
    label.className = 'config-key';
    label.textContent = item.key + ': ';
    div.appendChild(label);

    if (readOnlyKeys.includes(item.key)) {
      // 若屬於唯讀項目，直接以靜態方式呈現
      const valueSpan = document.createElement('span');
      valueSpan.className = 'config-value';
      valueSpan.textContent = configJson[item.key] || '';
      div.appendChild(valueSpan);
    } else {
      // 可編輯項目，建立文字輸入欄位
      const input = document.createElement('input');
      input.className = 'config-value';
      input.type = 'text';
      input.value = configJson[item.key] || '';
      // 使用 dataset 記錄 key，便於更新時讀取
      input.dataset.key = item.key;
      div.appendChild(input);
    }

    container.appendChild(div);
  });
}

// 更新設定檔按鈕：將所有可編輯項目的新值送出更新
document.getElementById('updateConfigBtn').addEventListener('click', function () {
  // 僅挑選 input.config-value（不包含唯讀的 span）
  const inputs = document.querySelectorAll('input.config-value');
  const updatedConfig = {};
  inputs.forEach(input => {
    const key = input.dataset.key;
    const value = input.value;
    updatedConfig[key] = value;
  });

  fetch('/update-all-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ configData: updatedConfig })
  })
    .then(res => res.json())
    .then(data => {
      document.getElementById('updateMessage').innerText = data.message || (data.error ? data.error : '更新成功');
      loadConfig();
    })
    .catch(err => console.error('Error:', err));
});

// 檢查網際網路連線狀況
function checkConnectionStatus() {
  fetch('/connection-status')
    .then(res => res.json())
    .then(data => {
      const statusEl = document.getElementById('connectionStatus');
      let text = data.message;
      if (data.wwan0IP) {
        text += " (IP: " + data.wwan0IP + ")";
      }
      statusEl.innerText = text;
      statusEl.style.color = data.connected ? 'green' : 'red';
    })
    .catch(err => {
      console.error('Error:', err);
      document.getElementById('connectionStatus').innerText = '無法取得連線狀態';
      document.getElementById('connectionStatus').style.color = 'red';
    });
}

setInterval(checkConnectionStatus, 60000);
document.getElementById('refreshConnectionBtn').addEventListener('click', checkConnectionStatus);
