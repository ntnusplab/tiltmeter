1. hwt9053_angle/status_led.sh  status_led.service
2. sensor_logs/cleanup_logs  crontab 0 1 * * * /home/admin/sensor_logs/cleanup_logs
3. reboot crontab 0 0 * * * /sbin/reboot
4. hotspot_setting.sh
5. mbim_connection_tool_install.sh
6. mbim_start_connect.sh mbim_start_connect.service
7. reset_time_on_boot.sh reset_time_on_boot.service
8. pm2 hwt9053
9. pm2 web
10. systemd-resolved 
11. ntp_setting