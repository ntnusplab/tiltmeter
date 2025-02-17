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

// Function to get RSSI using SerialPort
function getRssi() {
    return new Promise((resolve, reject) => {
        const portPath = '/dev/ttyUSB2';
        const baudRate = 115200;
        const atCommand = 'AT+QENG="servingcell"';

        const port = new SerialPort({ path: portPath, baudRate }, (err) => {
            if (err) {
                return reject(`Error opening serial port: ${err.message}`);
            }
        });

        const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

        parser.on('data', (data) => {
            // if (data.includes('+QENG') && !data.includes('AT+QENG')) {
                const parts = data.split(',');
                console.log(`Received response: ${data}`);
                console.log(`Response parts: ${parts}`);
                // if (parts.length >= 18) {
                //     const rssi = parts[parts.length - 3];
                //     console.log(`RSSI: ${rssi} dBm`);
                //     resolve(parseInt(rssi));
                //     port.close(); // Close the port after successful read
                // } else {
                //     reject('Response format does not contain the expected RSSI value.');
                //     port.close(); // Close the port on error
                // }
                port.close(); // Close the port after successful read
            // }
        });

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

// Export functions as a module
module.exports = {
    getCpuTemperature,
    getCpuVoltage,
    getRssi
};
