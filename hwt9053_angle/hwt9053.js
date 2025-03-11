require('dotenv').config(); // 使用 dotenv 管理環境變數
const { SerialPort } = require('serialport');
const axios = require('axios');
const { getCpuTemperature, getCpuVoltage, getRssi, getMemoryUsagePercentage, getDiskUsagePercentage } = require('./check_status');
const DailyLogger = require('./dailyLogger'); // 引入日誌模組
const net = require('net');
const path = require('path');
const fs = require('fs');

// 從環境變數讀取 API URL 與其他設定
const API_URL = process.env.API_URL;
const DEVICE_ID = process.env.DEVICE_ID;
// const ANGLE_DIFFERENT_THERSHOLD = process.env.ANGLE_DIFFERENT_THERSHOLD;
const BACKUP_TCP_HOST = process.env.BACKUP_TCP_HOST;
const BACKUP_TCP_PORT = process.env.BACKUP_TCP_PORT;
const BACKUP_TCP_TEST = process.env.BACKUP_TCP_TEST;
const SAMPLE_RATE = process.env.SAMPLE_RATE;
const SERIALPORT_PATH = process.env.SERIALPORT_PATH;

if (!API_URL) {
    console.error('Error: API_URL is not defined in the .env file.');
    process.exit(1);
}

if (!DEVICE_ID) {
    console.error('Error: DEVICE_ID is not defined in the .env file.');
    process.exit(1);
}

if (DEVICE_ID === "tiltmeter_default") {
    console.error('Error: DEVICE_ID need to change in the .env file.');
    process.exit(1);
}

// if (!ANGLE_DIFFERENT_THERSHOLD) {
//     console.error('Error: ANGLE_DIFFERENT_THERSHOLD is not defined in the .env file.');
//     process.exit(1);
// }

if (!BACKUP_TCP_HOST) {
    console.error('Error: BACKUP_TCP_HOST is not defined in the .env file.');
    process.exit(1);
}

if (!BACKUP_TCP_PORT) {
    console.error('Error: BACKUP_TCP_PORT is not defined in the .env file.');
    process.exit(1);
}

if (!BACKUP_TCP_TEST) {
    console.error('Error: BACKUP_TCP_TEST is not defined in the .env file.');
    process.exit(1);
}

if (!SAMPLE_RATE) {
    console.error('Error: SAMPLE_RATE is not defined in the .env file.');
    process.exit(1);
}

if (!SERIALPORT_PATH) {
    console.error('Error: SERIALPORT_PATH is not defined in the .env file.');
    process.exit(1);
}

const READ_ACCELERATION_COMMAND = Buffer.from([0x50, 0x03, 0x00, 0x3D, 0x00, 0x06, 0x59, 0x85]);
let startTime = Date.now(); // 當前絕對時間，毫秒
let startHrtime = process.hrtime.bigint(); // 高精度時間，納秒
let startDay = new Date(startTime).toISOString().split('T')[0]; // 當前日期字串
let dataBuffer = Buffer.alloc(0);

const dailyLogger = new DailyLogger();
// 用來記錄上次成功傳輸的 payload.sensing_time，初始為 null
let lastSuccessTime = null;
const bufferFilePath = path.join(__dirname, 'retryBuffer.json');

// 初始化 retryBuffer，從檔案讀取，如果檔案不存在則建立空陣列
let retryBuffer = [];
if (fs.existsSync(bufferFilePath)) {
    try {
        const data = fs.readFileSync(bufferFilePath, 'utf8');
        retryBuffer = JSON.parse(data);
    } catch (e) {
        console.error(`[${new Date().toISOString()}] Error reading ${bufferFilePath}:`, e);
        retryBuffer = [];
    }
}

function syncTimeAndSchedule() {
    console.log(`[${new Date().toISOString()}] Time synchronized using system clock.`);
    startTime = Date.now();
    startHrtime = process.hrtime.bigint();
    startDay = new Date(startTime).toISOString().split('T')[0];
    scheduleSendCommand();
}

// 串口設定
const port = new SerialPort({
    path: SERIALPORT_PATH, // 請依實際情況修改串口路徑
    baudRate: 115200,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
});

// 取得精確絕對時間
function getPreciseAbsoluteTime() {
    const elapsedNs = process.hrtime.bigint() - startHrtime;
    const elapsedMs = Number(elapsedNs / 1000000n);
    return new Date(startTime + elapsedMs);
}

// 發送讀取感測器指令
function sendCommand() {
    port.write(READ_ACCELERATION_COMMAND, (err) => {
        if (err) {
            console.error('Error writing to port:', err.message);
        }
    });
}

port.on('data', async (inputData) => {
    console.log("開始感測");
    dataBuffer = Buffer.concat([dataBuffer, inputData]);

    while (dataBuffer.length >= 17) {
        if (dataBuffer.slice(0, 3).equals(Buffer.from([0x50, 0x03, 0x0c]))) {
            const crcCalculated = crc16Modbus(dataBuffer.slice(0, 15));
            if (crcCalculated.equals(dataBuffer.slice(15, 17))) {
                let ang_x = (dataBuffer[5] << 24 | dataBuffer[6] << 16 | dataBuffer[3] << 8 | dataBuffer[4]) / 1000;
                let ang_y = (dataBuffer[9] << 24 | dataBuffer[10] << 16 | dataBuffer[7] << 8 | dataBuffer[8]) / 1000;
                let ang_z = (dataBuffer[13] << 24 | dataBuffer[14] << 16 | dataBuffer[11] << 8 | dataBuffer[12]) / 1000;

                const cpuTemp = await getCpuTemperature().catch(() => null);
                const cpuVolt = await getCpuVoltage().catch(() => null);
                const rssi = await getRssi().catch(() => null);
                const memUsage = await getMemoryUsagePercentage().catch(() => null);
                const diskUsage = await getDiskUsagePercentage().catch(() => null);

                const payload = {
                    sensing_time: getPreciseAbsoluteTime().toISOString(),
                    ang_x: ang_x.toFixed(3),
                    ang_y: ang_y.toFixed(3),
                    ang_z: ang_z.toFixed(3),
                    device_id: DEVICE_ID,
                    cpu_temperture: cpuTemp,
                    cpu_voltage: cpuVolt,
                    rssi: rssi,
                    memUsage: memUsage,
                    diskUsage: diskUsage
                };
                console.log(payload);
                try {
                    await sendDataToTcpServer(payload);
                } catch (error) {
                    console.error(`[${new Date().toISOString()}] Error during TCP transmission:`, error.message);
                }
                dailyLogger.save(payload);
                dataBuffer = dataBuffer.slice(17);
            } else {
                console.log("CRC validation failed, discarding data.");
                const errorLog = {
                    sensing_time: getPreciseAbsoluteTime().toISOString(),
                    error: 'CRC validation failed'
                };
                dailyLogger.save(errorLog);
                dataBuffer = dataBuffer.slice(17);
            }
        } else {
            const index = dataBuffer.indexOf(0x50, 1);
            if (index !== -1) {
                console.log(`Discarding ${index} bytes to find the next valid frame.`);
                dataBuffer = dataBuffer.slice(index);
            } else {
                console.log('No valid frame found, clearing buffer.');
                const errorLog = {
                    sensing_time: getPreciseAbsoluteTime().toISOString(),
                    error: 'No valid frame found'
                };
                dailyLogger.save(errorLog);
                dataBuffer = Buffer.alloc(0);
                break;
            }
        }
    }
});

// 讀取 JSON 檔案中的 buffer，若檔案不存在則回傳空陣列
async function readBufferFile() {
    try {
        const data = await fs.readFile(bufferFilePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        // 若檔案不存在或讀取失敗，則返回空陣列
        return [];
    }
}

// 將傳入的 buffer 陣列寫回 JSON 檔案
async function writeBufferFile(buffer) {
    try {
        await fs.promises.writeFile(bufferFilePath, JSON.stringify(buffer, null, 2));
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Error writing to ${bufferFilePath}:`, err.message);
    }
}

// 將 payload 追加到 JSON 檔案中
async function appendToBufferFile(payload) {
    const buffer = await readBufferFile();
    buffer.push(payload);
    await writeBufferFile(buffer);
}

async function sendDataToTcpServer(payload) {
    const client = new net.Socket();
    console.log(`[${new Date().toISOString()}] Sending data to DATABASE...`);

    try {
        // 嘗試發送新的 payload
        await axios.post(API_URL, payload);
        console.log(`[${new Date().toISOString()}] Sent to API_URL successfully.`);
        lastSuccessTime = payload.sensing_time; // 更新成功時間

        // 發送成功後，嘗試從 JSON 檔案中補傳資料
        await resendBufferedData();
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error during data transmission:`, error.message);
        // 發送失敗時，直接將 payload 寫入 JSON 檔案以便後續重傳
        await appendToBufferFile(payload);
    }

    // 備援 TCP 傳輸
    if (BACKUP_TCP_TEST === 'true') {
        sendBackupTcpData(payload, client);
    }
}

// 補傳 JSON 檔案內的資料
async function resendBufferedData() {
    const buffer = await readBufferFile();
    if (buffer.length === 0) return;

    console.log(`[${new Date().toISOString()}] Found ${buffer.length} buffered entries to resend.`);

    // 建立一個新的陣列，存放尚未成功傳送的資料
    const newBuffer = [];
    for (const entry of buffer) {
        try {
            await axios.post(API_URL, entry);
            console.log(`[${new Date().toISOString()}] Resent entry from ${entry.sensing_time} successfully.`);
        } catch (resendError) {
            console.error(`[${new Date().toISOString()}] Failed to resend entry from ${entry.sensing_time}:`, resendError.message);
            // 補傳失敗則保留該筆資料
            newBuffer.push(entry);
            // 可選：如果希望中斷後續傳送，可在此處 break; 不過此範例會嘗試全部傳送
        }
    }
    // 將尚未成功的資料重新寫回 JSON 檔案
    await writeBufferFile(newBuffer);
}

function sendBackupTcpData(payload, client) {
    client.connect(BACKUP_TCP_PORT, BACKUP_TCP_HOST, () => {
        let backup_payload = `$$$${DEVICE_ID},${payload.sensing_time},${payload.ang_x},${payload.ang_y},${payload.ang_z},${payload.cpu_temperture},${payload.cpu_voltage},${payload.rssi}###`;
        console.log(`[${new Date().toISOString()}] Sent data to TCP server...`);
        client.write(backup_payload, () => {
            client.end();
        });
    });

    client.on('error', (err) => {
        console.error(`TCP client error:`, err.message);
    });

    client.on('close', () => {
        console.log("TCP connection closed.");
    });
}


function scheduleSendCommand() {
    const now = new Date();
    const msUntilNextMinute = SAMPLE_RATE - ((now.getSeconds() * 1000 + now.getMilliseconds()) % SAMPLE_RATE);
    setTimeout(() => {
        sendCommand();
        setInterval(sendCommand, SAMPLE_RATE);
    }, msUntilNextMinute);
}

port.on('error', (err) => {
    console.error(`[${new Date().toISOString()}] Serial Port Error:`, err.message);
});

function crc16Modbus(buffer) {
    let crc = 0xFFFF;
    for (let byte of buffer) {
        crc ^= byte;
        for (let i = 0; i < 8; i++) {
            if (crc & 0x0001) {
                crc = (crc >> 1) ^ 0xA001;
            } else {
                crc >>= 1;
            }
        }
    }
    return Buffer.from([crc & 0xFF, (crc >> 8) & 0xFF]);
}

syncTimeAndSchedule();
