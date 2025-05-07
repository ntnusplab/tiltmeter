#!/usr/bin/env bash
LOCKFILE=/var/lock/get_nas_signaling_ip.lock

(
  flock -x -w 5 200 || {
    echo "Error: 無法取得鎖定，另一個程序正在使用 $DEVICE" >&2
    exit 1
  }
  set -euo pipefail

  DEVICE=${1:-/dev/ttyUSB2}
  BAUD=${2:-115200}
  TIMEOUT=${3:-3}

  # 1. 設 raw 模式、關 echo、關 flow control
  stty -F "$DEVICE" "$BAUD" raw -echo -echoe -echok -echoctl \
                        -ixon -ixoff cs8 -cstopb -parenb

  # 2. 開 fd3，並清空殘留
  exec 3<>"$DEVICE"
  timeout 1 cat <&3 > /dev/null 2>&1 || true

  # 3. 送 AT 指令（只帶 CR，避免多餘 LF）
  printf 'AT+CGPADDR\r' >&3

  # 4. 讀回應、過濾掉 echo
  RESPONSE=""
  while IFS= read -r -t "$TIMEOUT" LINE <&3; do
    [[ -z "$LINE" || "$LINE" == AT* ]] && continue
    RESPONSE+="$LINE"$'\n'
    [[ "$LINE" == OK || "$LINE" == ERROR ]] && break
  done

  # 關 fd3
  exec 3>&-; exec 3<&-

  # 5. 用正則抓 IP
  if [[ $RESPONSE =~ \+CGPADDR:\ 1,\"([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\" ]]; then
    echo "${BASH_REMATCH[1]}"
    exit 0
  else
    echo "Error: 無法取得 IP，模組回應：" >&2
    echo "$RESPONSE" >&2
    exit 1
  fi

) 200>"$LOCKFILE"
