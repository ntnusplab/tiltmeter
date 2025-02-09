#!/bin/bash

# 設置板載 LED 模式為 none
echo none > /sys/class/leds/ACT/trigger

# LED 行為控制：手動點亮和熄滅
while true; do
    echo 1 > /sys/class/leds/ACT/brightness  # 點亮 LED
    sleep 0.2                                  # 保持亮 1 秒
    echo 0 > /sys/class/leds/ACT/brightness  # 熄滅 LED
    sleep 0.2                                  # 保持滅 1 秒
done
