#!/bin/bash

# 設定資料夾路徑
LOG_DIR="/home/admin/sensor_log"

# 當前日期
CURRENT_DATE=$(date +%Y-%m-%d)

# 檢查資料夾是否存在
if [ ! -d "$LOG_DIR" ]; then
    echo "Error: Directory $LOG_DIR does not exist."
    exit 1
fi

# 迭代資料夾中的檔案
for file in "$LOG_DIR"/sensor_log_*.json; do
    # 檢查檔案是否存在，避免通配符未匹配到檔案情況
    if [ ! -e "$file" ]; then
        echo "No files found in $LOG_DIR matching pattern sensor_log_*.json"
        exit 0
    fi

    # 提取檔案中的日期部分 (格式: sensor_log_YYYY-MM-DD.json)
    BASENAME=$(basename "$file")
    FILE_DATE=$(echo "$BASENAME" | grep -oP '\d{4}-\d{2}-\d{2}')

    # 確保提取的日期有效
    if [[ ! $FILE_DATE =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
        echo "Skipping file with invalid date format: $file"
        continue
    fi

    # 計算文件日期與當前日期的天數差
    FILE_DATE_SECONDS=$(date -d "$FILE_DATE" +%s)
    CURRENT_DATE_SECONDS=$(date -d "$CURRENT_DATE" +%s)
    DAYS_DIFF=$(( (CURRENT_DATE_SECONDS - FILE_DATE_SECONDS) / 86400 ))

    # 如果超過 90 天，刪除文件
    if [ $DAYS_DIFF -gt 90 ]; then
        echo "Deleting file: $file (dated $FILE_DATE, $DAYS_DIFF days old)"
        rm "$file"
    else
        echo "Keeping file: $file (dated $FILE_DATE, $DAYS_DIFF days old)"
    fi
done
