1. hwt9053_angle/status_led.sh  status_led.service
2. sensor_logs/cleanup_logs  crontab 0 1 * * * /home/admin/sensor_logs/cleanup_logs
3. reboot crontab 0 0 * * * /sbin/reboot
4. hotspot_setting.sh
5. 4G_start_connect.sh 
6. reset_time_on_boot.sh reset_time_on_boot.service
7. pm2 hwt9053
8. pm2 website
9. systemd-resolved 
10. ntp_setting