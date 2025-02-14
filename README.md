# Tiltmeter

一個基於 Raspberry Pi Zero 2 W 的傾角計專案

## 簡介
本專案旨在利用 Raspberry Pi Zero 2 W 搭建一個傾角計系統，透過連接的傾角感測器（例如 MPU6050、ADXL345 等）實時監控和記錄設備的傾斜角度。這個系統適合應用於需要監測設備位置和姿態的各種場景。

## 功能特點
- **實時監控**：持續讀取感測器數據，實時監控傾斜角度。
- **數據記錄**：可選擇將數據存儲到本地文件或透過網路傳輸至伺服器。
- **易於擴展**：提供簡單的模組化程式架構，方便後續增加其他功能，如遠端監控、報警提示等。

## 硬體需求
- Raspberry Pi Zero 2 W
- 傾角感測器（例如：MPU6050、ADXL345 或其他）
- 面包板與連接線
- 電源供應器（符合 Pi Zero 2 W 的電源要求）

## 軟體需求
- 作業系統：建議使用最新版本的 Raspberry Pi OS（Raspbian）
- Python 3.x
- 必要的 Python 套件：
  - RPi.GPIO
  - smbus2 或 smbus
  - （根據感測器需求可能還需其他庫）

## 安裝與配置

### 1. 系統安裝
- 下載並燒錄最新版本的 Raspberry Pi OS 至 SD 卡。
- 將 SD 卡插入 Pi Zero 2 W，接上電源啟動系統。

### 2. 安裝必要套件
打開終端機，依次執行以下命令：
```bash
sudo apt-get update
sudo apt-get install python3 python3-pip