#!/usr/bin/env bash
# get_nas_signaling_ip.sh — 从 ttyUSB2 发 AT+CGPADDR 并回 Context 1 的 IP
# 加上 flock 防重入 + 关 echo + 缓冲区清理

LOCKFILE=/var/lock/get_nas_signaling_ip.lock

(
  # 1) 独占锁，最长等 5 秒
  flock -x -w 5 200 || {
    echo "Error: 无法取得串口锁，另一线程仍在操作" >&2
    exit 1
  }

  set -euo pipefail

  DEVICE=${1:-/dev/ttyUSB2}
  BAUD=${2:-115200}
  TIMEOUT=${3:-3}

  # 2) 设定波特率为 raw 模式，关闭回显
  stty -F "$DEVICE" raw speed "$BAUD" -echo || true

  # 3) 打开读/写文件描述符
  exec 3<>"$DEVICE"

  # 4) 先关掉模块自身的回显（ATE0），然后清空残余
  printf 'ATE0\r\n' >&3
  sleep 0.1
  while IFS= read -r -t 0.1 junk <&3; do :; done

  # 5) 发个 AT 确保模块处于 Ready，并再清空
  printf 'AT\r\n' >&3
  sleep 0.1
  while IFS= read -r -t 0.1 junk <&3; do :; done

  # 6) **最终清空一次所有残余数据**，保证缓冲区干净
  timeout 0.2 cat <&3 >/dev/null 2>&1 || true

  # 7) 发送真正的查询指令
  printf 'AT+CGPADDR=1\r\n' >&3

  # 8) 读取回馈，碰到 OK 或 ERROR 就停止
  RESPONSE=""
  while IFS= read -r -t "$TIMEOUT" LINE <&3; do
    RESPONSE+="$LINE"$'\n'
    [[ "$LINE" == "OK" || "$LINE" == "ERROR" ]] && break
  done

  # 9) 关闭串口描述符
  exec 3>&-; exec 3<&-

  # 10) 解析并输出 Context 1 的 IP
  if [[ $RESPONSE =~ \+CGPADDR:\ 1,\"([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\" ]]; then
    echo "${BASH_REMATCH[1]}"
    exit 0
  else
    echo "Error: 無法取得 IP，模組回應：" >&2
    echo "$RESPONSE" >&2
    exit 1
  fi

) 200>"$LOCKFILE"
