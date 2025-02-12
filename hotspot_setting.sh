#!/bin/bash
# 此腳本用來根據參數切換 wlan0 模式：
# enable  => 關閉 wpa_supplicant 並啟用熱點模式 (固定 IP + hostapd)
# disable => 停用熱點模式並啟動 wpa_supplicant（恢復客戶端模式）

# 定義 dhcpcd 設定檔路徑
DHCP_CONF="/etc/dhcpcd.conf"

# 定義固定 IP 區塊標記
HOTSPOT_BLOCK_START="# HOTSPOT STATIC CONFIG BEGIN"
HOTSPOT_BLOCK_END="# HOTSPOT STATIC CONFIG END"

# 根據傳入的參數選擇動作
if [ "$1" == "enable" ]; then
    echo "啟用熱點模式：關閉 wpa_supplicant 並設定 wlan0 為固定 IP。"
    
    # 停用 wpa_supplicant 服務（避免 wlan0 自動連外網）
    echo "停用 wpa_supplicant 服務..."
    sudo systemctl stop wpa_supplicant.service
    sudo systemctl disable wpa_supplicant.service

    # 移除舊有的熱點設定區塊（如果存在）
    sudo sed -i "/$HOTSPOT_BLOCK_START/,/$HOTSPOT_BLOCK_END/d" "$DHCP_CONF"
    
    # 在 /etc/dhcpcd.conf 末尾追加固定 IP 設定區塊
    sudo bash -c "cat >> $DHCP_CONF" <<EOF

$HOTSPOT_BLOCK_START
interface wlan0
    static ip_address=192.168.4.1/24
    nohook wpa_supplicant
$HOTSPOT_BLOCK_END
EOF

    echo "已於 $DHCP_CONF 加入固定 IP 設定。"

    # 重啟 dhcpcd 服務使新設定生效
    echo "重啟 dhcpcd 服務..."
    sudo systemctl restart dhcpcd

    # 啟動 hostapd 服務，將 wlan0 切換為 AP 模式
    echo "啟動 hostapd 服務..."
    sudo systemctl unmask hostapd
    sudo systemctl enable hostapd
    sudo systemctl start hostapd

    echo "熱點模式已啟用，wlan0 現在運作於 AP 模式 (固定 IP: 192.168.4.1/24)。"

elif [ "$1" == "disable" ]; then
    echo "停用熱點模式，恢復客戶端模式並啟動 wpa_supplicant。"

    # 移除 /etc/dhcpcd.conf 中的固定 IP 設定區塊
    sudo sed -i "/$HOTSPOT_BLOCK_START/,/$HOTSPOT_BLOCK_END/d" "$DHCP_CONF"
    echo "已從 $DHCP_CONF 移除固定 IP 設定。"

    # 重啟 dhcpcd 服務使設定生效
    echo "重啟 dhcpcd 服務..."
    sudo systemctl restart dhcpcd

    # 停止並禁用 hostapd 服務
    echo "停止 hostapd 服務..."
    sudo systemctl stop hostapd
    sudo systemctl disable hostapd

    # 啟動 wpa_supplicant 服務，恢復 wlan0 客戶端模式
    echo "啟動 wpa_supplicant 服務..."
    sudo systemctl enable wpa_supplicant
    sudo systemctl start wpa_supplicant

    echo "客戶端模式已恢復，wlan0 現在由 wpa_supplicant 管理。"

else
    echo "用法: $0 [enable|disable]"
    echo "  enable  => 啟用熱點模式（關閉 wpa_supplicant，設定固定 IP，啟動 hostapd）"
    echo "  disable => 停用熱點模式（移除固定 IP，停止 hostapd，啟動 wpa_supplicant）"
    exit 1
fi
