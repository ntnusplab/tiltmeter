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

// 讀取後端設定資料，並以後端資料與控制設定建立畫面
function loadConfig() {
  fetch('/config-json')
    .then(res => res.json())
    .then(data => {
      flatConfig = data;
      // 傳入取得的設定資料 flatConfig 與用來控制下拉選單顯示內容的 dropdownConfig
      populateConfigControls(flatConfig, dropdownConfig);
    })
    .catch(err => console.error('Error:', err));
}

// 用來控制下拉選單顯示內容的設定
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
 * 根據後端設定資料（configJson）與控制設定（controlConfig）
 * 1. 將 readOnlyKeys 中的項目以靜態欄位呈現
 * 2. 以下拉選單（僅顯示 key）及旁邊的文字欄位呈現可編輯項目，
 *    文字欄位顯示所選項目對應的 value，且允許編輯。
 */
function populateConfigControls(configJson, controlConfig) {
  const container = document.getElementById('configContainer');
  container.innerHTML = ''; // 清空舊內容

  const readOnlyKeys = controlConfig.readOnlyKeys || [];
  const options = controlConfig.options || [];

  // 處理唯讀欄位：直接以靜態方式顯示 key 與對應的 value
  options.forEach(item => {
    if (readOnlyKeys.includes(item.key)) {
      const roDiv = document.createElement('div');
      roDiv.className = 'config-item readonly';
      
      const label = document.createElement('span');
      label.className = 'config-key';
      label.textContent = item.key;
      
      const valueSpan = document.createElement('span');
      valueSpan.className = 'config-value';
      valueSpan.textContent = configJson[item.key] || '';
      
      roDiv.appendChild(label);
      roDiv.appendChild(document.createTextNode(': '));
      roDiv.appendChild(valueSpan);
      container.appendChild(roDiv);
    }
  });

  // 建立容器來放下拉選單與顯示對應值的文字欄位
  const dropdownContainer = document.createElement('div');
  dropdownContainer.className = 'dropdown-container';

  // 建立下拉選單：僅加入非唯讀且不在隱藏清單中的項目
  const dropdown = document.createElement('select');
  dropdown.id = 'configDropdown';
  const hiddenKeys = controlConfig.hiddenKeys || [];
  options.forEach(item => {
    if (hiddenKeys.includes(item.key)) return;
    if (readOnlyKeys.includes(item.key)) return;
    
    const option = document.createElement('option');
    option.value = item.key;
    option.textContent = item.key; // 僅顯示 key
    dropdown.appendChild(option);
  });

  // 建立文字欄位用以顯示下拉選單選項對應的 value，並允許編輯
  const valueField = document.createElement('input');
  valueField.id = 'selectedValueField';
  valueField.type = 'text';
  // 不設定 readOnly，使其可以編輯
  valueField.placeholder = '對應的值';

  if (dropdown.options.length > 0) {
    dropdownContainer.appendChild(dropdown);
    dropdownContainer.appendChild(valueField);
    container.appendChild(dropdownContainer);

    // 初始化文字欄位：根據下拉選單第一個選項顯示對應的值
    const initialKey = dropdown.value;
    valueField.value = configJson[initialKey] || '';

    // 當下拉選單選項改變時，更新文字欄位內容，但使用者可以自行編輯
    dropdown.addEventListener('change', function () {
      const selectedKey = dropdown.value;
      valueField.value = configJson[selectedKey] || '';
    });
  }
}

// 更新設定檔按鈕：根據下拉選單與文字欄位取得使用者修改的資料後送出更新請求
document.getElementById('updateConfigBtn').addEventListener('click', function () {
  const dropdown = document.getElementById('configDropdown');
  const valueField = document.getElementById('selectedValueField');
  
  if (!dropdown || !valueField) {
    console.error('無法找到下拉選單或對應的文字欄位');
    return;
  }
  
  const selectedKey = dropdown.value;
  const newValue = valueField.value;
  const updatedConfig = {};
  updatedConfig[selectedKey] = newValue;

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
