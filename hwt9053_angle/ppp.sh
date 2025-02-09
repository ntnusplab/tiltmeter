#!/bin/bash

# 顯示腳本啟動訊息
echo "重新同步系統時間..."

# 確保時間同步服務啟用
sudo timedatectl set-ntp true

# 強制同步時間
sudo systemctl restart systemd-timesyncd

# 顯示同步完成訊息
echo "系統時間同步完成！"

# 顯示當前時間
date
