#!/bin/bash

# 定义变量
URL="https://files.waveshare.com/wiki/PCIe%20TO%205G%20HAT%2B/Dial-Tool/waveshare-CM-tools.zip"
TMP_DIR="/tmp/waveshare-CM-tools"
DEST_DIR="/etc/waveshare-CM-tools"
BIN_LINK="/usr/local/bin/waveshare-CM"

# 创建临时目录
mkdir -p $TMP_DIR

# 下载文件
wget -O $TMP_DIR/waveshare-CM-tools.zip $URL

# 解压文件
unzip $TMP_DIR/waveshare-CM-tools.zip -d $TMP_DIR

# 创建目标目录
sudo mkdir -p $DEST_DIR

# 复制文件到目标目录
sudo cp -r $TMP_DIR/waveshare-CM-tools/* $DEST_DIR/

# 创建软链接
sudo ln -sf $DEST_DIR/waveshare-CM $BIN_LINK

# 清理临时文件
rm -rf $TMP_DIR

# 删除自身
rm -- "$0"

# 提示完成
echo "Installation completed. You can now run 'waveshare-CM' using 'sudo'."
