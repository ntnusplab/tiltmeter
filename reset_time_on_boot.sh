#!/bin/bash
# 持續檢查 wwan0 介面是否有取得 IPv4 地址

while true; do
    # 取得 wwan0 介面的 IPv4 地址
    ip_addr=$(ip -4 addr show wwan0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}')
    
    if [ -n "$ip_addr" ]; then
        echo "檢測到 wwan0 的 IPv4 地址：$ip_addr"
        echo "開始重啟 systemd-timesyncd 服務..."
        sudo systemctl restart systemd-timesyncd.service
        sudo pm2 restart 1
        # 重啟後退出迴圈，若希望持續監控，可移除此 break
        break
    fi

    # 暫停 5 秒再檢查
    sleep 5
done
