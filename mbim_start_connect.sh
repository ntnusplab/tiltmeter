#!/bin/bash

# 1. 停止任何現存的 4G 連線程式（如 pppd、qmicli 或 waveshare-CM）
pkill -f pppd
pkill -f qmicli
pkill -f waveshare-CM

# 2. 載入 APN 設定
source /home/admin/tiltmeter/sys.conf
# sys.conf 範例：
#   APN="internet"
#   PDP_CID=1

# 3. 設定要用的序列埠與 CID
TTY="/dev/ttyUSB2"
CID="${PDP_CID:-1}"

echo "◆ 設定 PDP Context ${CID} APN 為：${APN}"
echo "◆ 使用序列埠：${TTY}"

# 4. 把序列埠設成 raw、115200 baud、關 echo（確保正確送/收）
stty -F "$TTY" raw cs8 115200 -echo

# 5. 發出 AT 指令修改 APN
#    格式：AT+CGDCONT=<CID>,"IP","<APN>"
echo -e "AT+CGDCONT=${CID},\"IP\",\"${APN}\"\r" > "$TTY"
sleep 0.5

# 6. 讀回確認
echo -e "AT+CGDCONT?\r" > "$TTY"
sleep 0.5
# 只印包含 +CGDCONT 且包含你指定 CID 的那一行
grep "+CGDCONT" < "$TTY" | grep "${CID}"

# ————————————
# 8. 在更新 APN 之後，發送重啟模組指令
echo "◆ 發送模組重啟指令 (AT+CFUN=1,1)..."
echo -e "AT+CFUN=1,1\r" > "$TTY"
sleep 0.5
stty -F "$TTY" echo

echo "◆ 4G 模組重啟指令已送出"
