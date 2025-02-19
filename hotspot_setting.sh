#!/bin/bash

# 預設參數
CON_NAME="tiltmeter"
SSID="tiltmeter_0"
PSK="28579684"

# 解析命令列參數
usage() {
    echo "Usage: $0 [-n connection_name] [-s ssid] [-p password]"
    exit 1
}

while getopts "n:s:p:" opt; do
    case $opt in
        n)
            CON_NAME="$OPTARG"
            ;;
        s)
            SSID="$OPTARG"
            ;;
        p)
            PSK="$OPTARG"
            ;;
        *)
            usage
            ;;
    esac
done

echo "使用以下設定建立或啟動接入點："
echo "連線名稱 (con-name): $CON_NAME"
echo "SSID: $SSID"
echo "密碼 (psk): $PSK"

# 檢查是否已有重複的連線名稱
dupCon=$(sudo nmcli connection show | grep -x "$CON_NAME")
if [ -n "$dupCon" ]; then
    echo "發現已存在連線名稱 '$CON_NAME'，將直接啟動該連線。"
else
    # 停用 dnsmasq（若已安裝），避免與 NetworkManager 衝突
    if systemctl is-active --quiet dnsmasq; then
        echo "dnsmasq 服務正在運行，正在停用..."
        sudo systemctl stop dnsmasq
        sudo systemctl disable dnsmasq
    fi

    # 使用 nmcli 創建並配置 Wi‑Fi 接入點
    echo "創建 Wi‑Fi 接入點..."
    sudo nmcli connection add type wifi ifname wlan0 con-name "$CON_NAME" autoconnect yes \
        ssid "$SSID" \
        802-11-wireless.mode ap \
        802-11-wireless.band bg \
        ipv4.method shared ipv4.address 192.168.2.1/24 \
        wifi-sec.key-mgmt wpa-psk \
        wifi-sec.pairwise ccmp \
        wifi-sec.proto rsn \
        wifi-sec.psk "$PSK"
fi

# 啟動接入點連線
echo "啟動 Wi‑Fi 接入點..."
sudo nmcli connection up "$CON_NAME"

# # 顯示接入點設定狀態（供確認用）
# echo "顯示接入點設定："
# nmcli connection show "$CON_NAME"

echo "Wi‑Fi 接入點設定完成。請使用裝置連接 SSID '$SSID' 並使用密碼 '$PSK'。"

# 手動加入 DNS 設定到 /etc/resolv.conf
echo "檢查 /etc/resolv.conf 是否已包含 DNS 設定..."

if grep -q "nameserver 8.8.8.8" /etc/resolv.conf; then
    echo "已存在 nameserver 8.8.8.8"
else
    echo "加入 nameserver 8.8.8.8"
    sudo sh -c 'echo "nameserver 8.8.8.8" >> /etc/resolv.conf'
fi

if grep -q "nameserver 8.8.4.4" /etc/resolv.conf; then
    echo "已存在 nameserver 8.8.4.4"
else
    echo "加入 nameserver 8.8.4.4"
    sudo sh -c 'echo "nameserver 8.8.4.4" >> /etc/resolv.conf'
fi

echo "DNS 設定檢查完成。"

#記得關閉network manager的dns還有disable modemmanager