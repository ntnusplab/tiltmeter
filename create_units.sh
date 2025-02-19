#!/bin/bash
# 此腳本用於依據參數建立多個 systemd service 與 timer 單元
# 需以 root 權限執行 (例如 sudo)
#
# 使用說明:
#   -b "service_name:command"
#       定義一個開機自動執行的 service，
#       service_name 為服務名稱，command 為執行該服務的指令或程式路徑。
#
#   -t "service_name:command:OnCalendar_expression"
#       定義一個定時執行的 service，
#       service_name 為服務名稱，command 為執行指令，
#       OnCalendar_expression 為 systemd.timer 的時間格式設定
#
# 範例:
# sudo ./create_units.sh \
#   -b "boot1:/path/to/boot_script1" \
#   -b "boot2:/path/to/boot_script2" \
#   -t "timer1:/path/to/timer_script1:*-*-* 00:05:00" \
#   -t "timer2:/path/to/timer_script2:*-*-* 01:05:00"

usage() {
    echo "Usage: $0 -b boot_service_definition [-b boot_service_definition ...] -t timer_definition [-t timer_definition ...]"
    echo " boot_service_definition format: service_name:command"
    echo " timer_definition format: service_name:command:OnCalendar_expression"
    exit 1
}

# 宣告陣列，分別儲存開機與定時的設定
declare -a boot_services
declare -a timer_services

# 解析參數
while getopts "b:t:" opt; do
  case $opt in
    b)
      boot_services+=("$OPTARG")
      ;;
    t)
      timer_services+=("$OPTARG")
      ;;
    *)
      usage
      ;;
  esac
done

# 檢查至少提供一組設定
if [ ${#boot_services[@]} -eq 0 ] && [ ${#timer_services[@]} -eq 0 ]; then
    echo "請至少提供一個開機或定時 service 的定義。"
    usage
fi

# 如果數量不符預期，給予警告（非必要）
if [ ${#boot_services[@]} -ne 2 ]; then
    echo "警告：建議提供 2 個開機執行的 service，目前數量為 ${#boot_services[@]}。"
fi

if [ ${#timer_services[@]} -ne 2 ]; then
    echo "警告：建議提供 2 個定時執行的 service，目前數量為 ${#timer_services[@]}。"
fi

# 建立開機 service 單元檔
for svc in "${boot_services[@]}"; do
    # 以冒號分隔 service 名稱與執行命令
    IFS=':' read -r svc_name svc_command <<< "$svc"
    service_file="/etc/systemd/system/${svc_name}.service"
    echo "建立開機 service 檔案：${service_file}"
    cat <<EOF > "${service_file}"
[Unit]
Description=${svc_name} (Boot Service)
After=network.target

[Service]
Type=simple
ExecStart=${svc_command}

[Install]
WantedBy=multi-user.target
EOF
done

# 建立定時 service 及 timer 單元檔
for t in "${timer_services[@]}"; do
    # 格式：service_name:command:OnCalendar_expression
    IFS=':' read -r svc_name svc_command calendar_expr <<< "$t"
    service_file="/etc/systemd/system/${svc_name}.service"
    timer_file="/etc/systemd/system/${svc_name}.timer"
    
    echo "建立定時 service 檔案：${service_file}"
    cat <<EOF > "${service_file}"
[Unit]
Description=${svc_name} (Timer Service)
After=network.target

[Service]
Type=simple
ExecStart=${svc_command}

[Install]
WantedBy=multi-user.target
EOF

    echo "建立 timer 檔案：${timer_file} (OnCalendar=${calendar_expr})"
    cat <<EOF > "${timer_file}"
[Unit]
Description=Timer for ${svc_name}

[Timer]
OnCalendar=${calendar_expr}
Persistent=true
Unit=${svc_name}.service

[Install]
WantedBy=timers.target
EOF
done

echo "重新載入 systemd 設定..."
systemctl daemon-reload

# 啟用並啟動開機 service
for svc in "${boot_services[@]}"; do
    IFS=':' read -r svc_name svc_command <<< "$svc"
    echo "啟用並啟動 ${svc_name}.service"
    systemctl enable --now "${svc_name}.service"
done

# 啟用並啟動定時 service 與 timer
for t in "${timer_services[@]}"; do
    IFS=':' read -r svc_name svc_command calendar_expr <<< "$t"
    echo "啟用並啟動 ${svc_name}.timer 與 ${svc_name}.service"
    systemctl enable --now "${svc_name}.service"
    systemctl enable --now "${svc_name}.timer"
done

echo "所有 service 與 timer 單元設定完成！"
