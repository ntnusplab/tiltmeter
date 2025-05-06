#!/bin/bash
set -e

# 1. 停止任何現存的 4G 連線程式
pkill -f pppd       || true
pkill -f qmicli     || true
pkill -f waveshare-CM || true

# 2. 載入 APN 設定
source /home/admin/tiltmeter/sys.conf
# sys.conf 範例：
#   APN="internet"
#   PDP_CID=1

# 3. 指定要用的 AT 埠為 /dev/ttyUSB3
TTY="/dev/ttyUSB3"
CID="${PDP_CID:-1}"

echo "[INFO] 設定 PDP Context ${CID} APN 為: ${APN}"
echo "[INFO] 使用序列埠: ${TTY}"

# 4. 設定 serial 埠：只設 baud rate 與 cs8
if ! stty -F "$TTY" 115200 cs8; then
  echo "[WARN] 無法完全設定 $TTY，繼續執行"
fi

# 5. 發出 AT 指令修改 APN
echo -e "AT+CGDCONT=${CID},\"IP\",\"${APN}\"\r" > "$TTY"
sleep 0.5

# 6. 讀回確認
echo -e "AT+CGDCONT?\r" > "$TTY"
sleep 0.5
if ! grep "+CGDCONT" < "$TTY" | grep -q "${CID}"; then
  echo "[WARN] 未讀到 CGDCONT 回應 (CID=${CID})"
fi

# 7. 發送重啟模組指令
echo "[INFO] 發送模組重啟指令 AT+CFUN=1,1"
echo -e "AT+CFUN=1,1\r" > "$TTY"
sleep 0.5

echo "[INFO] 4G 模組重啟指令已送出"
