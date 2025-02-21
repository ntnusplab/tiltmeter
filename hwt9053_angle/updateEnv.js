const fs = require('fs');
const path = require('path');

// 設定 .env 文件路徑
const envFilePath = path.join(__dirname, '.env');

// 檢查 .env 文件是否存在
if (!fs.existsSync(envFilePath)) {
  console.error(".env 文件不存在");
  process.exit(1);
}

// 讀取 .env 文件內容
let envContent = fs.readFileSync(envFilePath, 'utf8');

// 取得命令列參數，格式預期為 KEY=VALUE
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("請至少提供一個參數，例如：API_URL=\"https://new-url.com/api/data\"");
  process.exit(1);
}

args.forEach(arg => {
  const index = arg.indexOf('=');
  if (index === -1) {
    console.error(`參數格式錯誤：${arg}，預期格式 KEY=VALUE`);
    return;
  }
  const key = arg.substring(0, index).trim();
  const value = arg.substring(index + 1).trim();

  // 建立正則表達式，匹配以 key 開頭的整行（考慮左右空格、=符號及其後內容）
  const regex = new RegExp(`^\\s*${key}\\s*=.*$`, 'm');
  if (regex.test(envContent)) {
    // 若存在則替換整行
    envContent = envContent.replace(regex, `${key}=${value}`);
    console.log(`更新 ${key} 為 ${value}`);
  } else {
    // 若不存在則附加到文件末尾
    envContent += `\n${key}=${value}`;
    console.log(`新增 ${key}，設定值為 ${value}`);
  }
});

// 寫回更新後的內容到 .env 文件
fs.writeFileSync(envFilePath, envContent);
console.log(".env 文件更新完成！");
