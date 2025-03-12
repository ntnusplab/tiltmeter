#!/bin/bash

# 先停止之前背景執行的 waveshare-CM 程序
pkill -f waveshare-CM

# 從 apn.conf 中讀取 APN 變數
source /home/admin/tiltmeter/sys.conf

echo "正在使用 APN: $APN 啟動 4G 連線..."
sudo waveshare-CM -s "$APN" &
