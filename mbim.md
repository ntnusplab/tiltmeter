[Unit]
Description=Status led Service
After=network.target

[Service]
Type=forking
ExecStart=/bin/bash /home/admin/tiltmeter/hwt9053_angle/status_led.sh
WorkingDirectory=/home/admin/tiltmeter/hwt9053_angle
Restart=on-failure
# 若腳本內部已使用 sudo，可考慮將服務以 root 執行，否則移除 sudo
# User=root

[Install]
WantedBy=multi-user.target