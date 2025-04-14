#!/bin/bash

# 停止之前可能存在的 waveshare-CM
pkill -f waveshare-CM

# 載入APN設定
source /home/admin/tiltmeter/sys.conf

echo "正在使用 APN: $APN 啟動 4G 連線..."

# 使用 nohup 來啟動，保證後台穩定執行，不受腳本結束影響
nohup waveshare-CM -s "$APN" >/dev/null 2>&1 &
