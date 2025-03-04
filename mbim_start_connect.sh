#!/bin/bash
#
# mbim_connect.sh
#
# 說明:
# 這個腳本用來啟動 4G 連線，利用 waveshare-CM 指令，
# 並以參數指定 APN（存取點名稱）。
#
# 使用方法:
#   sudo ./mbim_connect.sh YOUR_APN
#
# 範例:
#   sudo ./mbim_connect.sh internet
#

# 檢查是否有傳入 APN 參數
if [ "$#" -ne 1 ]; then
    echo "使用方法: sudo $0 YOUR_APN"
    exit 1
fi

APN="$1"

echo "正在使用 APN: $APN 啟動 4G 連線..."
sudo waveshare-CM -s "$APN"
