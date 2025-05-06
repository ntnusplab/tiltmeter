#!/bin/bash

# 1. 停止任何現存的 4G 連線程式（如 pppd、qmicli 或 waveshare-CM）
pkill -f pppd
pkill -f qmicli
pkill -f waveshare-CM

# 2. 載入 APN 設定
source /home/admin/tiltmeter/sys.conf
#    sys.conf 範例：
#    APN="internet"
#    PDP_CID=1

# 3. 設定要用的序列埠（請依實際情況調整）
TTY="/dev/ttyUSB2"
CID=1

echo "◆ 設定 PDP Context ${CID} APN 為：${APN}"
echo "◆ 使用序列埠：${TTY}"

# 5. 發出 AT 指令修改 APN
#    格式：AT+CGDCONT=<CID>,"IP","<APN>"
echo -e "AT+CGDCONT=${CID},\"IP\",\"${APN}\"\r" > "$TTY"

# 6. 稍作等待，讓模組回應
sleep 0.5

# 7. 用 AT+CGDCONT? 讀回所有 context 設定，並過濾出剛改的那一行
echo -e "AT+CGDCONT?\r" > "$TTY"
sleep 0.5
# 只印包含 +CGDCONT 且包含你指定 CID 的行
grep "+CGDCONT" < "$TTY" | grep "${CID}"

# 8. 恢復序列埠 echo（可選）
stty -F "$TTY" echo

echo "◆ APN 設定完成。"
