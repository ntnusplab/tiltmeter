sudo pm2 stop tiltmeter
sudo bash -c 'stty -F /dev/ttyUSB0 115200 raw; printf "\x50\x06\x00\x00\x00\x00\x84\x4B" > /dev/ttyUSB0;'
# sudo bash -c 'stty -F /dev/ttyUSB0 9600 cs8 -cstopb -parenb raw; printf "\x50\x03\x00\x3D\x00\x06\x59\x85" > /dev/ttyUSB0; sleep 1; timeout 1 dd if=/dev/ttyUSB0 bs=1 count=100 2>/dev/null | od -tx1 -An'
sudo pm2 start tiltmeter