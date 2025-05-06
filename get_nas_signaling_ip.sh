#!/usr/bin/env bash
# get_nas_signaling_ip.sh — 從 ttyUSB2 發 AT+CGPADDR 並回傳 Context 1 的 IP

set -euo pipefail

DEVICE=${1:-/dev/ttyUSB2}
BAUD=${2:-115200}
TIMEOUT=${3:-3}

# 1. 嘗試只設定波特率，忽略所有輸出
stty -F "$DEVICE" "$BAUD" >/dev/null 2>&1 || true

# 2. 開啟讀寫
exec 3<>"$DEVICE"

# 3. 送 AT 指令要求 IP（Context 1）
printf 'AT+CGPADDR\r\n' >&3

# 4. 用 timeout 讀整段回應，碰到 OK/ERROR 就跳出
RESPONSE=""
while IFS= read -r -t "$TIMEOUT" LINE <&3; do
  RESPONSE+="$LINE"$'\n'
  [[ "$LINE" == "OK" || "$LINE" == "ERROR" ]] && break
done

# 5. 關掉 fd3
exec 3>&-; exec 3<&-

# 6. 解析並輸出 IP
if [[ $RESPONSE =~ \+CGPADDR:\ 1,\"([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\" ]]; then
  echo "${BASH_REMATCH[1]}"
  exit 0
else
  echo "Error: 無法取得 IP，模組回應：" >&2
  echo "$RESPONSE" >&2
  exit 1
fi
