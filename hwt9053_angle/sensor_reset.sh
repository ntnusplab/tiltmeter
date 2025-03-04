sudo pm2 stop tiltmeter
sudo bash -c 'stty -F /dev/ttyS0 115200 raw; printf "\x50\x06\x00\x01\x00\x08\xD4\x4D" > /dev/ttyUSB0;'
sudo bash -c 'stty -F /dev/ttyS0 115200 raw; printf "\x50\x06\x00\x01\x00\x04\xD4\x48" > /dev/ttyUSB0;'
sudo pm2 start tiltmeter