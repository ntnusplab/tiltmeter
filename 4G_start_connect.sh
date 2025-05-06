#!/usr/bin/env bash
# get_nas_signaling_ip.sh — 从 ttyUSB2 发 AT+CGPADDR 并回 Context 1 的 IP
# 并用 flock 防止重入、先清空残余数据

LOCKFILE=/var/lock/get_nas_signaling_ip.lock

(
  # 独占锁，最多等 5 秒
  flock -x -w 5 200 || {
    echo "Error: 无法取得串口锁，另一线程仍在操作" >&2
    exit 1
  }

  set -euo pipefail

  DEVICE=${1:-/dev/ttyUSB2}
  BAUD=${2:-115200}
  TIMEOUT=${3:-3}

  # 1. 设定波特率（忽略错误输出）
  stty -F "$DEVICE" "$BAUD" >/dev/null 2>&1 || true

  # 2. 打开读/写
  exec 3<>"$DEVICE"

  # 3. **清空输入缓冲区**：把所有残余数据读走
  timeout 0.1 cat <&3 >/dev/null 2>&1 || true

  # 4. 发送 AT+CGPADDR
  printf 'AT+CGPADDR\r\n' >&3

  # 5. 读回馈，碰到 OK/ERROR 就停止
  RESPONSE=""
  while IFS= read -r -t "$TIMEOUT" LINE <&3; do
    RESPONSE+="$LINE"$'\n'
    [[ "$LINE" == "OK" || "$LINE" == "ERROR" ]] && break
  done

  # 6. 关闭 fd3
  exec 3>&-; exec 3<&-

  # 7. 解析并输出 IP
  if [[ $RESPONSE =~ \+CGPADDR:\ 1,\"([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\" ]]; then
    echo "${BASH_REMATCH[1]}"
    exit 0
  else
    echo "Error: 无法取得 IP，模块回馈：" >&2
    echo "$RESPONSE" >&2
    exit 1
  fi

) 200>"$LOCKFILE"
