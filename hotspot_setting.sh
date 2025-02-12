#!/bin/bash
# 此腳本用來設定 wlan0 為固定 IP 並啟動 hostapd 建立熱點
# 使用固定 IP 192.168.4.1/24，不使用 DHCP 伺服器

# 定義 /etc/dhcpcd.conf 檔案位置
DHCP_CONF="/etc/dhcpcd.conf"

# 定義要加入的設定區塊標記
HOTSPOT_BLOCK_START="# HOTSPOT STATIC CONFIG BEGIN"
HOTSPOT_BLOCK_END="# HOTSPOT STATIC CONFIG END"

echo "設定 wlan0 為固定 IP (192.168.4.1/24) ..."

# 刪除先前可能加入的區塊（若存在）
sudo sed -i "/$HOTSPOT_BLOCK_START/,/$HOTSPOT_BLOCK_END/d" "$DHCP_CONF"

# 追加固定 IP 設定區塊到 /etc/dhcpcd.conf 末尾
sudo bash -c "cat >> $DHCP_CONF" <<EOF

$HOTSPOT_BLOCK_START
interface wlan0
    static ip_address=192.168.4.1/24
    nohook wpa_supplicant
$HOTSPOT_BLOCK_END
EOF

echo "已於 $DHCP_CONF 加入固定 IP 設定。"

# 重啟 dhcpcd 服務以使設定生效
echo "重啟 dhcpcd 服務..."
sudo systemctl restart dhcpcd

# 啟動 hostapd 服務
echo "啟動 hostapd 服務，建立熱點..."
sudo systemctl unmask hostapd
sudo systemctl enable hostapd
sudo systemctl start hostapd

echo "熱點已啟動：wlan0 設定為 192.168.4.1/24，hostapd 正在運作。"
