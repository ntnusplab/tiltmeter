'use strict';

const fs = require('fs');
const path = require('path');

class DailyLogger {
    constructor(directory = '/home/admin/tiltmeter/sensor_log') {
        this.directory = directory;
        this.date = new Date().toISOString().split('T')[0]; // 當前日期，格式 YYYY-MM-DD
        this.logFilePath = path.join(this.directory, `sensor_log_${this.date}.json`);

        // 確保資料夾存在
        if (!fs.existsSync(this.directory)) {
            fs.mkdirSync(this.directory, { recursive: true });
            console.log(`Created directory: ${this.directory}`);
        }

        // 檢查文件是否存在，如果不存在則創建並初始化為空數組
        if (!fs.existsSync(this.logFilePath)) {
            try {
                fs.writeFileSync(this.logFilePath, JSON.stringify([]), 'utf8');
                console.log(`Initialized log file: ${this.logFilePath}`);
            } catch (error) {
                console.error(`Error initializing log file: ${this.logFilePath}`, error.message);
            }
        }
    }

    // 保存數據（有效或錯誤）
    save(data) {
        try {
            const existingData = JSON.parse(fs.readFileSync(this.logFilePath, 'utf8'));
            existingData.push(data);
            fs.writeFileSync(this.logFilePath, JSON.stringify(existingData, null, 2), 'utf8');
            console.log(`[${new Date().toISOString()}] Appended data to log: ${this.logFilePath}`);
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Error appending to log file: ${this.logFilePath}`, error.message);
            console.error(error.stack);  // 打印堆疊信息
        }
    }
}

module.exports = DailyLogger;
