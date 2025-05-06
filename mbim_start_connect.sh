#!/bin/bash
set -e

# 1. 停止任何現存的 4G 連線程式
pkill -f pppd    || true
pkill -f qmicli  || true
pkill -f waveshare-CM || true

# 2. 載入 APN 設定
source /home/admin/tiltmeter/sys.conf
# sys.conf 範例：
#   APN="internet"
#   PDP_CID=1

# 3. 自動偵測 AT 埠（或你也可直接 export TTY=/dev/ttyUSB2）
TTY="${TTY:-$(ls /dev/ttyUSB3/dev/null | head -n1)}"
CID="${PDP_CID:-1}"

echo "◆ 設定 PDP Context ${CID} APN 為：${APN}"
echo "◆ 使用序列埠：${TTY}"

# 4. 設定 serial 埠：只設 baud rate 與 cs8
if ! stty -F "$TTY" 115200 cs8; then
  echo "⚠️ stty 無法完全設定 $TTY（忽略）"
fi

# 5. 發出 AT 指令修改 APN
echo -e "AT+CGDCONT=${CID},\"IP\",\"${APN}\"\r" > "$TTY"
sleep 0.5

# 6. 讀回確認
echo -e "AT+CGDCONT?\r" > "$TTY"
sleep 0.5
grep "+CGDCONT" < "$TTY" | grep "${CID}" || echo "⚠️ 未讀到指定的 CGDCONT 回應"

# 7. 發送重啟模組指令
echo "◆ 發送模組重啟指令 (AT+CFUN=1,1)..."
echo -e "AT+CFUN=1,1\r" > "$TTY"
sleep 0.5

echo "◆ 4G 模組重啟指令已送出"
