#!/bin/bash
# 此腳本用來根據參數修改 dhcpcd.conf，
# enable 參數表示啟用熱點模式（設定靜態 IP），
# disable 則表示停用熱點模式（恢復 DHCP 模式）。

# 定義 dhcpcd.conf 檔案路徑
DHCP_CONF="/etc/dhcpcd.conf"

# 定義 Hotspot 配置區塊的標記
HOTSPOT_BLOCK_START="# BEGIN HOTSPOT CONFIG"
HOTSPOT_BLOCK_END="# END HOTSPOT CONFIG"

if [ "$1" == "enable" ]; then
    echo "啟用熱點模式，設定 wlan0 為固定 IP..."
    
    # 先移除可能已存在的 Hotspot 區塊（避免重複）
    sudo sed -i "/$HOTSPOT_BLOCK_START/,/$HOTSPOT_BLOCK_END/d" "$DHCP_CONF"
    
    # 將 Hotspot 設定區塊附加到 dhcpcd.conf 末尾
    sudo bash -c "cat >> $DHCP_CONF" <<EOF

$HOTSPOT_BLOCK_START
interface wlan0
    static ip_address=192.168.4.1/24
    nohook wpa_supplicant
$HOTSPOT_BLOCK_END
EOF

    # 啟動 hostapd 服務，開啟 AP 模式
    sudo systemctl unmask hostapd
    sudo systemctl enable hostapd
    sudo systemctl start hostapd

    echo "熱點模式已啟用，wlan0 的固定 IP 設定為 192.168.4.1/24。"

elif [ "$1" == "disable" ]; then
    echo "停用熱點模式，恢復使用 DHCP..."
    
    # 移除 Hotspot 設定區塊
    sudo sed -i "/$HOTSPOT_BLOCK_START/,/$HOTSPOT_BLOCK_END/d" "$DHCP_CONF"
    
    # 停用 hostapd 服務
    sudo systemctl stop hostapd
    sudo systemctl disable hostapd

    echo "熱點模式已停用，wlan0 將改以 DHCP 模式運作。"

else
    echo "用法：$0 [enable|disable]"
    echo "  enable  => 啟用熱點模式（設定固定 IP 並啟動 hostapd）"
    echo "  disable => 停用熱點模式（移除固定 IP 設定，恢復 DHCP 並停止 hostapd）"
    exit 1
fi

# 重啟 dhcpcd 服務，使設定立即生效
sudo systemctl restart dhcpcd
echo "dhcpcd 服務已重啟。"
