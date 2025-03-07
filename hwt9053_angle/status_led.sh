#!/bin/bash
# 設定 LED 的 sysfs 路徑為 ACT（請根據你的 PI 型號確認）
LED_PATH="/sys/class/leds/ACT"

# 設定要 ping 的 IP 位址，這裡以 8.8.8.8 為例，你可以自行修改
IP="tilt.smartiout.com"
PORT="443"

# 將 LED trigger 設為 none，以便手動控制 LED
echo none > "${LED_PATH}/trigger"

# 捕捉中斷信號，結束時將 LED 熄滅
trap "echo 0 > ${LED_PATH}/brightness; exit" SIGINT SIGTERM

# 定義 LED 常亮函數
led_on() {
    echo 0 > "${LED_PATH}/brightness"
}

# 定義 LED 熄滅函數
led_off() {
    echo 1 > "${LED_PATH}/brightness"
}

# 定義 LED 閃爍函數，參數 $1 為持續時間（秒）
led_blink() {
    local duration=$1
    local end_time=$(( $(date +%s) + duration ))
    while [ $(date +%s) -lt ${end_time} ]; do
        led_on
        sleep 0.2
        led_off
        sleep 0.2
    done
}

# 主迴圈：每隔 1 分鐘執行一次 ping 指令，根據結果切換 LED 模式
while true; do
    if nc -z -v -w 10 "$IP" "$PORT" > /dev/null 2>&1; then
        # 當 ping 成功時，讓 LED 常亮 60 秒
        led_on
        sleep 5
    else
        # 當 ping 失敗時，讓 LED 閃爍 60 秒
        led_blink 60
    fi
done