[Unit]
Description=Waveshare 4G Connection Service
After=network.target

[Service]
Type=forking
ExecStart=/bin/bash /home/admin/tiltmeter/mbim_start_connect.sh
WorkingDirectory=/home/admin/tiltmeter
Restart=on-failure
# 若腳本內部已使用 sudo，可考慮將服務以 root 執行，否則移除 sudo
# User=root

[Install]
WantedBy=multi-user.target