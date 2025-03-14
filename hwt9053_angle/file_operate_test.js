const fs = require('fs');
// const net = require('net');
const axios = require('axios');

// 讀取 JSON 檔案中的 buffer，若檔案不存在則回傳空陣列
async function readBufferFile() {
    try {
        const data = await fs.promises.readFile(bufferFilePath, 'utf8');
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

async function resendBufferedData() {
    let buffer = await readBufferFile();
    if (buffer.length === 0) return;

    console.log(`[${new Date().toISOString()}] Found ${buffer.length} buffered entries to resend.`);

    while (buffer.length > 0) {
        const entry = buffer.pop(); // 每次從 buffer 取出最後一筆資料
        try {
            await axios.post(API_URL, entry);
            console.log(`[${new Date().toISOString()}] Resent entry from ${entry.sensing_time} successfully.`);
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Failed to resend entry from ${entry.sensing_time}:`, error.message);
            // 若傳送失敗，將該筆資料補回 buffer，然後中斷迴圈
            buffer.push(entry);
            break;
        }
    }

    // 將尚未成功傳送的資料寫回 JSON 檔案
    await writeBufferFile(buffer);
}