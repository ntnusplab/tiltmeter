#!/bin/bash

# 停止可能已經存在的 waveshare-CM 進程
pkill -f waveshare-CM

# 從 sys.conf 中讀取 APN 變數
source /home/admin/tiltmeter/sys.conf

echo "正在使用 APN: $APN 啟動 4G 連線..."

# 直接執行 waveshare-CM（前景模式）
exec waveshare-CM -s "$APN"
