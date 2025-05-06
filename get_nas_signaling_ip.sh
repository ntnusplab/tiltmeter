#!/usr/bin/env bash
# get_ip.sh — 從 ttyUSB2 發 AT+CGPADDR 並回傳 Context 1 的 IP

set -euo pipefail

# 參數設定（可修改或透過參數傳入）
DEVICE=${1:-/dev/ttyUSB2}    # 串口裝置
BAUD=${2:-115200}            # 波特率
TIMEOUT=${3:-3}              # 讀取超時秒數

# 1. 設定 serial port 參數：115200 8N1，raw 模式，關閉 echo
stty -F "$DEVICE" "$BAUD" cs8 -cstopb -parenb -ixon -ixoff -icanon min 1 time 1 -echo

# 2. 送出 AT 指令
printf "AT+CGPADDR\r" > "$DEVICE"

# 3. 讀取回應（限制 TIMEOUT 秒）
RESPONSE=$(timeout "$TIMEOUT" cat "$DEVICE" || true)

# 4. 解析出 +CGPADDR: 1,"x.x.x.x" 裡的 IP
if [[ $RESPONSE =~ \+CGPADDR:\ 1,\"([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\" ]]; then
  echo "${BASH_REMATCH[1]}"
  exit 0
else
  echo "Error: 無法取得 IP（回應：）" >&2
  echo "$RESPONSE" >&2
  exit 1
fi
