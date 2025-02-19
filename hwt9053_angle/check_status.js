// Import necessary modules
const { exec } = require('child_process');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

// Function to get CPU temperature
function getCpuTemperature() {
    return new Promise((resolve, reject) => {
        exec('vcgencmd measure_temp', (error, stdout, stderr) => {
            if (error || stderr) {
                reject(`Error getting CPU temperature: ${error || stderr}`);
                return;
            }
            const match = stdout.match(/temp=([0-9.]+)'C/);
            if (match) {
                resolve(parseFloat(match[1]));
            } else {
                reject('Could not parse CPU temperature.');
            }
        });
    });
}

// Function to get CPU voltage
function getCpuVoltage() {
    return new Promise((resolve, reject) => {
        exec('vcgencmd measure_volts', (error, stdout, stderr) => {
            if (error || stderr) {
                reject(`Error getting CPU voltage: ${error || stderr}`);
                return;
            }
            const match = stdout.match(/volt=([0-9.]+)V/);
            if (match) {
                resolve(parseFloat(match[1]));
            } else {
                reject('Could not parse CPU voltage.');
            }
        });
    });
}

// Function to get RSSI from a serial port
function getRssi() {
    return new Promise((resolve, reject) => {
        const portPath = '/dev/ttyUSB2';
        const baudRate = 115200;
        const atCommand = 'AT+QENG="servingcell"';

        // 開啟串口
        const port = new SerialPort({ path: portPath, baudRate }, (err) => {
            if (err) {
                return reject(`Error opening serial port: ${err.message}`);
            }
        });

        const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

        // 當收到資料時
        parser.on('data', (data) => {
            // 檢查是否為我們需要處理的回應資料
            if (data.includes('+QENG') && !data.includes('AT+QENG')) {
                console.log(`Received response: ${data}`);
                const parts = data.split(',');
                console.log(`Response parts: ${parts}`);

                if (parts.length >= 3) {
                    // 擷取倒數第三個欄位，並去除可能的空白
                    const rssi = parts[parts.length - 3].trim();
                    console.log(`Extracted RSSI: ${rssi}`);
                    // 將字串轉換為整數後 resolve
                    resolve(parseInt(rssi));
                } else {
                    reject('Response format does not contain the expected RSSI value.');
                }
                // 無論成功或失敗，讀取後都關閉串口
                port.close();
            }
        });

        // 當串口成功開啟時發送 AT 指令
        port.on('open', () => {
            console.log(`Sending command: ${atCommand}`);
            port.write(atCommand + '\r\n', (err) => {
                if (err) {
                    reject(`Failed to send AT command: ${err.message}`);
                    port.close();
                }
            });
        });

        port.on('error', (err) => {
            reject(`Serial port error: ${err.message}`);
        });
    });
}

// 新增的函數：取得記憶體使用百分比
function getMemoryUsagePercentage() {
    return new Promise((resolve, reject) => {
        exec('free -m', (error, stdout, stderr) => {
            if (error || stderr) {
                reject(`Error getting memory usage: ${error || stderr}`);
                return;
            }
            // 解析 free -m 的輸出，尋找 "Mem:" 開頭的那一行
            const lines = stdout.split('\n');
            const memLine = lines.find(line => line.startsWith('Mem:'));
            if (!memLine) {
                reject('Could not parse memory usage.');
                return;
            }
            const parts = memLine.split(/\s+/);
            // parts 格式: ["Mem:", "total", "used", "free", "shared", "buff/cache", "available"]
            if (parts.length < 3) {
                reject('Memory usage output does not have enough columns.');
                return;
            }
            const total = parseInt(parts[1]);
            const used = parseInt(parts[2]);
            if (total === 0) {
                reject('Total memory is zero.');
                return;
            }
            // 計算百分比，保留小數點後兩位
            const percentage = ((used / total) * 100).toFixed(2);
            resolve(percentage);
        });
    });
}

// Export functions as a module
module.exports = {
    getCpuTemperature,
    getCpuVoltage,
    getRssi,
    getMemoryUsagePercentage  // 新增的記憶體監控函數，只回傳使用百分比
};
