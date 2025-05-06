#!/bin/bash
set -e

# 1. 停止任何現存的 4G 連線程式
pkill -f pppd       || true
pkill -f qmicli     || true
pkill -f waveshare-CM || true

# 2. 載入 APN 設定
source /home/admin/tiltmeter/sys.conf
# sys.conf 範例：
#   APN="internet.iot"
#   PDP_CID=1

# 3. 指定 AT 埠
TTY="/dev/ttyUSB3"
CID="${PDP_CID:-1}"

echo "[INFO] 設定 PDP Context ${CID} APN 為: ${APN}"
echo "[INFO] 使用序列埠: ${TTY}"

# 4. 發出 AT+CGDCONT 設定 APN
echo -e "AT+CGDCONT=${CID},\"IP\",\"${APN}\"\r" > "$TTY"
sleep 0.5

# 5. 查詢並讀回 CGDCONT 回應（最多等 2 秒）
echo -e "AT+CGDCONT?\r" > "$TTY"
RESPONSE=$(timeout 2 cat "$TTY" || true)

if echo "$RESPONSE" | grep -q "+CGDCONT.*${CID}"; then
  LINE=$(echo "$RESPONSE" | grep "+CGDCONT.*${CID}")
  echo "[INFO] CGDCONT 回應: ${LINE}"
else
  echo "[WARN] 未讀到 CGDCONT 回應 (CID=${CID})"
fi

# 6. 發送重啟模組指令
echo "[INFO] 發送模組重啟指令 AT+CFUN=1,1"
echo -e "AT+CFUN=1,1\r" > "$TTY"
sleep 0.5

echo "[INFO] 4G 模組重啟指令已送出"
