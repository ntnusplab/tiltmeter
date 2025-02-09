const { exec } = require('child_process');

// Function to get RSSI
function getRssi() {
    return new Promise((resolve, reject) => {
        // Execute the qmicli command and save the output to signal_output.txt
        exec("sudo qmicli -d /dev/cdc-wdm0 --nas-get-signal-strength > signal_output.txt", (error, stdout, stderr) => {
            if (error || stderr) {
                reject(`Error getting RSSI: ${error || stderr}`);
                return;
            }

            // Extract the 7th line and extract the RSSI value using sed
            exec("sed -n '7p' signal_output.txt | sed \"s/Network 'lte': '\\([0-9+-]*\\) dBm'/\\1/\"", (error, stdout, stderr) => {
                if (error || stderr) {
                    reject(`Error parsing RSSI: ${error || stderr}`);
                    return;
                }
                
                // Print the RSSI value
                console.log(`RSSI: ${stdout.trim()} dBm`);
                resolve(stdout.trim());
            });
        });
    });
}

// Call the function to get and print RSSI
getRssi().then(rssi => {
    console.log(`Final RSSI: ${rssi} dBm`);
}).catch(error => {
    console.error(error);
});
