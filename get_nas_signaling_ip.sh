#!/usr/bin/env bash
# get_nas_signaling_ip.sh — 從 ttyUSB2 發 AT+CGPADDR 並回傳 Context 1 的 IP

set -euo pipefail

# 參數：DEVICE 波特率 TIMEOUT
DEVICE=${1:-/dev/ttyUSB2}
BAUD=${2:-115200}
TIMEOUT=${3:-3}

# 1. 用最簡單的方式 config serial：raw 模式、指定波特率、關閉 echo
stty -F "$DEVICE" raw speed "$BAUD" -echo

# 2. 以 fd3 同時開啟讀寫
exec 3<>"$DEVICE"

# 3. 送出 AT 指令
printf "AT+CGPADDR\r" >&3

# 4. 讀取回應（遇到 OK/ERROR 就停止，或超過 TIMEOUT 秒結束）
RESPONSE=""
while IFS= read -r -t "$TIMEOUT" LINE <&3; do
  RESPONSE+="$LINE"$'\n'
  # 收到 OK 或 ERROR 就跳出
  [[ "$LINE" == "OK" || "$LINE" == "ERROR" ]] && break
done

# 關掉 fd3
exec 3>&-
exec 3<&-

# 5. 解析出 Context 1 的 IP
if [[ $RESPONSE =~ \+CGPADDR:\ 1,\"([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\" ]]; then
  echo "${BASH_REMATCH[1]}"
  exit 0
else
  echo "Error: 無法取得 IP，模組回應：" >&2
  echo "$RESPONSE" >&2
  exit 1
fi
