let flatConfig = {};

// 登入功能：點擊按鈕或在密碼欄按 Enter 觸發
document.getElementById('loginButton').addEventListener('click', login);
document.getElementById('password').addEventListener('keyup', function(e) {
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

function loadConfig() {
  fetch('/config-json')
    .then(res => res.json())
    .then(data => {
      flatConfig = data;
      populateConfigForm(flatConfig);
    })
    .catch(err => console.error('Error:', err));
}

function populateConfigForm(config) {
  const container = document.getElementById('configContainer');
  container.innerHTML = ''; // 清空舊內容
  // 將每個 key-value 以一個區塊呈現
  for (const key in config) {
    const div = document.createElement('div');
    div.className = 'config-item';
    
    const label = document.createElement('span');
    label.className = 'config-key';
    label.textContent = key + ':';
    
    const input = document.createElement('input');
    input.className = 'config-value';
    input.type = 'text';
    input.value = config[key];
    input.dataset.key = key;
    
    div.appendChild(label);
    div.appendChild(input);
    container.appendChild(div);
  }
}

document.getElementById('updateConfigBtn').addEventListener('click', function(){
  const inputs = document.querySelectorAll('.config-value');
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

function checkConnectionStatus() {
  fetch('/connection-status')
    .then(res => res.json())
    .then(data => {
      const statusEl = document.getElementById('connectionStatus');
      // 取得連線訊息
      let text = data.message;
      // 若有取得 wwan0 的 IP，則附加在訊息後面
      if (data.wwan0IP) {
        text += " (wwan0 IP: " + data.wwan0IP + ")";
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


// 每分鐘自動刷新網際網路連線狀況
setInterval(checkConnectionStatus, 60000);

// 手動刷新按鈕事件
document.getElementById('refreshConnectionBtn').addEventListener('click', checkConnectionStatus);
