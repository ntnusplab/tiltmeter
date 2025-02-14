#!/bin/bash
# 本腳本根據 PiLink 的文章「如何僅使用 NetWorkManager 將 Raspi 變成 Wi-Fi 接入點」編寫，
# 並提供命令列參數來修改 con-name、ssid 與 psk。
# 文章來源：https://pilink.jp/zh-hans/wifi-ap_pl-r4/

# 預設參數
CON_NAME="rpi_ap"
SSID="raspida-lan"
PSK="password"

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

echo "使用以下設定建立接入點："
echo "連線名稱 (con-name): $CON_NAME"
echo "SSID: $SSID"
echo "密碼 (psk): $PSK"

# 停用 dnsmasq（若已安裝），避免與 NetworkManager 衝突
if systemctl is-active --quiet dnsmasq; then
    echo "dnsmasq 服務正在運行，正在停用..."
    sudo systemctl stop dnsmasq
    sudo systemctl disable dnsmasq
fi

# 使用 nmcli 創建並配置 Wi‑Fi 接入點
echo "創建 Wi‑Fi 接入點..."
sudo nmcli connection add type wifi ifname eth0 con-name "$CON_NAME" autoconnect yes \
    ssid "$SSID" \
    802-11-wireless.mode ap \
    802-11-wireless.band bg \
    ipv4.method shared ipv4.address 192.168.2.1/24 \
    wifi-sec.key-mgmt wpa-psk \
    wifi-sec.pairwise ccmp \
    wifi-sec.proto rsn \
    wifi-sec.psk "$PSK"

# 啟動接入點連線
echo "啟動 Wi‑Fi 接入點..."
sudo nmcli connection up "$CON_NAME"

# 可選：重啟 NetworkManager 服務以確保配置生效
echo "重啟 NetworkManager 服務..."
sudo systemctl restart NetworkManager.service

# 顯示接入點設定狀態（供確認用）
echo "顯示接入點設定："
nmcli connection show "$CON_NAME"

echo "Wi‑Fi 接入點設定完成。請使用裝置連接 SSID '$SSID' 並使用密碼 '$PSK'。"
