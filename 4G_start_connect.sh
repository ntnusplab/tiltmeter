#!/usr/bin/env bash
# send_cfun.sh — 透過 ttyUSB2 發 AT+CFUN=1,1，並用 flock 防止重入

LOCKFILE=/var/lock/send_cfun.lock

(
  # 1) 取得鎖，最長等 5 秒
  flock -x -w 5 200 || {
    echo "Error: 無法取得鎖定，另一執行序仍在操作 $DEVICE" >&2
    exit 1
  }

  set -euo pipefail

  DEVICE=${1:-/dev/ttyUSB2}
  BAUD=${2:-115200}
  TIMEOUT=${3:-10}

  # 2) 設 raw 模式、關 echo；stty 若失敗也不阻止後續
  stty -F "$DEVICE" raw speed "$BAUD" -echo 2>/dev/null || true

  # 3) 開啟讀寫 fd3，並快速清空所有殘留
  exec 3<>"$DEVICE"
  timeout 0.1 cat <&3 >/dev/null 2>&1 || true

  # 4) 送出 AT+CFUN=1,1
  printf 'AT+CFUN=1,1\r\n' >&3

  # 5) （可選）讀取回應直到 OK/ERROR 或 timeout
  while IFS= read -r -t "$TIMEOUT" LINE <&3; do
    echo "$LINE"
    [[ "$LINE" == "OK" || "$LINE" == "ERROR" ]] && break
  done

  # 6) 關掉 fd3
  exec 3>&-; exec 3<&-

) 200>"$LOCKFILE"
