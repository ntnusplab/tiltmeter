#!/usr/bin/env bash
# get_nas_signaling_ip.sh — 從 ttyUSB2 發 AT+CGPADDR 並回傳 Context 1 的 IP，並用 flock 防止重入

LOCKFILE=/var/lock/get_nas_signaling_ip.lock

(
  # 以 fd 200 取得獨占鎖，最長等 5 秒
  flock -x -w 5 200 || {
    echo "Error: 無法取得串口鎖，另一個執行緒仍在操作" >&2
    exit 1
  }

  set -euo pipefail

  DEVICE=${1:-/dev/ttyUSB2}
  BAUD=${2:-115200}
  TIMEOUT=${3:-3}

  # 設定波特率（忽略錯誤輸出）
  stty -F "$DEVICE" "$BAUD" >/dev/null 2>&1 || true

  # 同時開啟讀／寫
  exec 3<>"$DEVICE"

  # 發 AT 指令
  printf 'AT+CGPADDR\r\n' >&3

  # 讀回應，遇到 OK/ERROR 就停止
  RESPONSE=""
  while IFS= read -r -t "$TIMEOUT" LINE <&3; do
    RESPONSE+="$LINE"$'\n'
    [[ "$LINE" == "OK" || "$LINE" == "ERROR" ]] && break
  done

  # 關閉 fd3
  exec 3>&-; exec 3<&-

  # 解析並輸出 Context 1 的 IP
  if [[ $RESPONSE =~ \+CGPADDR:\ 1,\"([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\" ]]; then
    echo "${BASH_REMATCH[1]}"
    exit 0
  else
    echo "Error: 無法取得 IP，模組回應：" >&2
    echo "$RESPONSE" >&2
    exit 1
  fi

) 200>"$LOCKFILE"
