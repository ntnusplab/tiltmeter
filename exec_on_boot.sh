sudo /home/admin/tiltmeter/create_units.sh \
  -b "status_led:/home/admin/tiltmeter/hwt9053_angle/status_led.sh" \
  -b "hotspot_setting:/home/admin/tiltmeter/hotspot_setting.sh" \
  -t "reboot:/sbin/reboot:*-*-* 00:00:00" \
  -t "cleanup_logs:/home/admin/tiltmeter/sensor_log/cleanup_logs.sh:*-*-* 23:59:00"
