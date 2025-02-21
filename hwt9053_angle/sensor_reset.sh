sudo pm2 stop tiltmeter
sudo bash -c 'printf "\x50\x06\x00\x01\x00\x08\xD4\x4D" > /dev/ttyUSB0;'
sudo bash -c 'printf "\x50\x06\x00\x01\x00\x04\xD4\x48" > /dev/ttyUSB0;'
sudo pm2 start tiltmeter