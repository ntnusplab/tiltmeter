const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

// 配置串口參數
const portPath = '/dev/ttyUSB2'; // 串口名稱
const baudRate = 115200; // 波特率
const atCommand = 'AT+QENG="servingcell"'; // 要發送的 AT 指令

const port = new SerialPort({ path: portPath, baudRate }, (err) => {
    if (err) {
        return console.error('無法打開串口:', err.message);
    }
    console.log(`已連接到 ${portPath}，波特率: ${baudRate}`);
});

const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

// 監聽回應
parser.on('data', (data) => {
    console.log('設備回應:', data);

    // 如果回應包含 "+QENG" 並且以 "OK" 結尾
    if (data.includes('+QENG') && !data.includes('AT+QENG')) {
        const parts = data.split(','); // 用逗號分隔回應內容
        if (parts.length >= 18) { // 確保有足夠的欄位
            const targetValue = parts[parts.length - 3]; // 倒數第 3 個值
            console.log('倒數第 3 個值:', targetValue);
        } else {
            console.log('回應格式無法提取所需值');
        }
    }
});

// 發送指令
port.on('open', () => {
    console.log(`發送指令: ${atCommand}`);
    port.write(atCommand + '\r\n', (err) => {
        if (err) {
            return console.error('發送失敗:', err.message);
        }
        console.log('指令已發送');
    });
});
