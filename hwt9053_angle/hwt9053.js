require('dotenv').config(); // 使用 dotenv 管理環境變數
const { SerialPort } = require('serialport');
const axios = require('axios');
const { getCpuTemperature, getCpuVoltage, getRssi, getMemoryUsagePercentage, getDiskUsagePercentage } = require('./check_status');
const DailyLogger = require('./dailyLogger'); // 引入模組
const net = require('net');

// 從環境變數讀取 API URL
const API_URL = process.env.API_URL;
const DEVICE_ID = process.env.DEVICE_ID;
const ANGLE_DIFFERENT_THERSHOLD = process.env.ANGLE_DIFFERENT_THERSHOLD;
const BACKUP_TCP_HOST = process.env.BACKUP_TCP_HOST;
const BACKUP_TCP_PORT = process.env.BACKUP_TCP_PORT;
const BACKUP_TCP_TEST = process.env.BACKUP_TCP_TEST;
const SAMPLE_RATE = process.env.SAMPLE_RATE;

if (!API_URL) {
    console.error('Error: API_URL is not defined in the .env file.');
    process.exit(1)
}

if (!DEVICE_ID) {
    console.error('Error: DEVICE_ID is not defined in the .env file.');
    process.exit(1);
}

if (!ANGLE_DIFFERENT_THERSHOLD) {
    console.error('Error: ANGLE_DIFFERENT_THERSHOLD is not defined in the .env file.');
    process.exit(1);
}

if (!BACKUP_TCP_HOST) {
    console.error('Error: BACKUP_TCP_HOST is not defined in the .env file.');
    process.exit(1)

} if (!BACKUP_TCP_PORT) {
    console.error('Error: BACKUP_TCP_PORT is not defined in the .env file.');
    process.exit(1)
}

if (!BACKUP_TCP_TEST) {
    console.error('Error: BACKUP_TCP_TEST is not defined in the .env file.');
    process.exit(1)
}
if (!SAMPLE_RATE) {
    console.error('Error: SAMPLE_RATE is not defined in the .env file.');
    process.exit(1)
}

const READ_ACCELERATION_COMMAND = Buffer.from([0x50, 0x03, 0x00, 0x3D, 0x00, 0x06, 0x59, 0x85]);
let startTime = Date.now(); // 当前绝对时间，毫秒
let startHrtime = process.hrtime.bigint(); // 当前高分辨率时间，纳秒
let startDay = new Date(startTime).toISOString().split('T')[0]; // 記錄當前日期
let dataBuffer = Buffer.alloc(0);
let payloadBuffer = [];

const dailyLogger = new DailyLogger();
function syncTimeAndSchedule() {
    // 確保使用 Pi 的系統時間進行同步
    console.log(`[${new Date().toISOString()}] Time synchronized using system clock.`);
    startTime = Date.now();
    startHrtime = process.hrtime.bigint();
    startDay = new Date(startTime).toISOString().split('T')[0];

    // 啟動命令排程
    scheduleSendCommand();
}

// 串口設置
const port = new SerialPort({
    path: '/dev/ttyS0', // 修改為實際的串口名稱
    baudRate: 115200,    // 設置波特率為 115200
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
});

// 获取当前绝对时间
function getPreciseAbsoluteTime() {
    const elapsedNs = process.hrtime.bigint() - startHrtime; // 经过的纳秒
    const elapsedMs = Number(elapsedNs / 1000000n); // 转为毫秒
    return new Date(startTime + elapsedMs); // 返回 ISO 格式时间
}

// 發送指令
function sendCommand() {
    port.write(READ_ACCELERATION_COMMAND, (err) => {
        if (err) {
            console.error('Error writing to port:', err.message);
        }
    });
}


port.on('data', async (inputData) => {
    console.log("開始感測");

    // 累積 inputData 到 dataBuffer
    dataBuffer = Buffer.concat([dataBuffer, inputData]);

    while (dataBuffer.length >= 17) { // 確保有足夠長度
        if (dataBuffer.slice(0, 3).equals(Buffer.from([0x50, 0x03, 0x0c]))) {
            const crcCalculated = crc16Modbus(dataBuffer.slice(0, 15));

            if (crcCalculated.equals(dataBuffer.slice(15, 17))) {
                // 正確數據處理
                let ang_x = (dataBuffer[5] << 24 | dataBuffer[6] << 16 | dataBuffer[3] << 8 | dataBuffer[4]) / 1000;
                let ang_y = (dataBuffer[9] << 24 | dataBuffer[10] << 16 | dataBuffer[7] << 8 | dataBuffer[8]) / 1000;
                let ang_z = (dataBuffer[13] << 24 | dataBuffer[14] << 16 | dataBuffer[11] << 8 | dataBuffer[12]) / 1000;

                // 從 module 獲取額外資料
                const cpuTemp = await getCpuTemperature().catch(() => null);
                const cpuVolt = await getCpuVoltage().catch(() => null);
                const rssi = await getRssi().catch(() => null);
                const memUsage = await getMemoryUsagePercentage().catch(() => null);
                const diskUsage = await getDiskUsagePercentage().catch(() => null);
                // const rssi = null

                // 準備要傳送的資料
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

                // console.log(payload);

                // 將資料添加到緩存中（插入到緩存的最前面）
                payloadBuffer.unshift(payload);

                // console.log(`[${new Date().toISOString()}] Data added to buffer:`);
                console.log("Payload Buffer:", payloadBuffer);

                try {
                    await sendDataToTcpServer(); // 嘗試通過 TCP 傳輸資料
                } catch (error) {
                    console.error(`[${new Date().toISOString()}] Error during TCP transmission:`, error.message);
                }

                dailyLogger.save(payload); // 保存有效數據

                // 移除已處理的數據
                dataBuffer = dataBuffer.slice(17);
            } else {
                console.log("CRC validation failed, discarding data.");
                // 記錄無效數據的錯誤
                const errorLog = {
                    sensing_time: getPreciseAbsoluteTime().toISOString(),
                    error: 'CRC validation failed'
                };
                dailyLogger.save(errorLog); // 保存錯誤數據
                dataBuffer = dataBuffer.slice(17); // 丟棄無效數據
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
                dailyLogger.save(errorLog); // 保存錯誤數據
                dataBuffer = Buffer.alloc(0);
                break;
            }
        }
    }
});

async function sendDataToTcpServer() {
    const client = new net.Socket();
    if (payloadBuffer.length === 0) {
        console.log("No data in payloadBuffer to send.");
        return;
    }
    else {

        while (payloadBuffer.length > 0) {
            const data = payloadBuffer.pop(); // 取出緩存中的數據

            console.log(`[${new Date().toISOString()}] Sent data to DATABASE...`);
            try {
                await axios.post(API_URL, data);
                console.log(`[${new Date().toISOString()}] Sent to API_URL successfully.`);
            }
            catch (error) {
                console.error(`[${new Date().toISOString()}] Error during data transmission:`, error.message);
            }
            if (BACKUP_TCP_TEST === true) {
                client.connect(BACKUP_TCP_PORT, BACKUP_TCP_HOST, () => {
                    let backup_payload = `$$$${DEVICE_ID},${data.sensing_time},${data.ang_x},${data.ang_y},${data.ang_z},${data.cpu_temperture},${data.cpu_voltage},${data.rssi}###`;
                    console.log(`[${new Date().toISOString()}] Sent data to TCP server...`);
                    client.write(backup_payload);
                });
                client.end(); // 關閉連接
            }
        }
    }

    client.on('error', (err) => {
        console.error(`TCP client error:`, err.message);
    });

    client.on('close', () => {
        console.log("TCP connection closed.");
    });
}

// 每1分鐘發送一次讀取指令
function scheduleSendCommand() {
    const now = new Date();
    const msUntilNextMinute = SAMPLE_RATE - ((now.getSeconds() * 1000 + now.getMilliseconds()) % SAMPLE_RATE);
    setTimeout(() => {
        sendCommand();
        setInterval(sendCommand, SAMPLE_RATE); // 確保每分鐘執行一次
    }, msUntilNextMinute);
}

// 處理串口錯誤
port.on('error', (err) => {
    console.error(`[${new Date().toISOString()}] Serial Port Error:`, err.message);
});

function crc16Modbus(buffer) {
    let crc = 0xFFFF; // 初始值

    for (let byte of buffer) {
        crc ^= byte; // 将当前字节与 CRC 累计值异或

        for (let i = 0; i < 8; i++) {
            if (crc & 0x0001) {
                crc = (crc >> 1) ^ 0xA001; // 如果最低位为 1，右移后与多项式异或
            } else {
                crc >>= 1; // 如果最低位为 0，直接右移
            }
        }
    }

    // 返回低字节和高字节，按 Modbus 协议顺序（低字节在前）
    return Buffer.from([crc & 0xFF, (crc >> 8) & 0xFF]);
}

// 開始初始化並執行時間同步與命令排程
syncTimeAndSchedule();
