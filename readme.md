# ⚡ Project Phasor S3

> An edge-computing wireless signal intelligence & rogue device detection appliance powered by ESP32-S3 and backed by academic research, featuring a zero-backend React Web Serial dashboard.

![Hardware Platform](https://img.shields.io/badge/Hardware-ESP32--S3%20(N8R8)-blue?style=for-the-badge&logo=espressif)
![Firmware](https://img.shields.io/badge/Firmware-C%2B%2B%20%2F%20Arduino-00599C?style=for-the-badge&logo=c%2B%2B)
![Frontend](https://img.shields.io/badge/Dashboard-React%20%2B%20Tailwind-61DAFB?style=for-the-badge&logo=react)
![Protocol](https://img.shields.io/badge/Transport-Web%20Serial%20API-emerald?style=for-the-badge)

---

## 📌 Executive Summary

**Project Phasor S3** transitions traditional wireless auditing away from bulky, power-hungry desktop setups into a covert, highly portable hardware appliance. Operating on the dual-core **Freenove ESP32-S3 (N8R8)**, the device executes passive 2.4 GHz 802.11 spectrum analysis, Bluetooth Low Energy (BLE) proximity tracking, and EAPOL handshake monitoring. 

Instead of relying strictly on easily forged MAC addresses, the system's detection logic is grounded in peer-reviewed academic research—leveraging multi-subset RSSI spatial consistency, channel state telemetry, and temporal feature profiling to isolate rogue Access Points (APs) and spoofed endpoints in real time.

---

## 🔬 Theoretical Grounding & Academic Citations

The architecture and detection algorithms of Phasor S3 draw directly from current literature in wireless security:

1. **Spatial Position Consistency**
   * *Paper:* **"Position-based Rogue Access Point Detection"** — *Wenjie Liu & Panos Papadimitratos (2024)*.
   * *Application:* Evaluates multi-subset RSSI spatial consistency captured via promiscuous mode to flag anomalies introduced by rogue APs copying legitimate SSIDs/BSSIDs.

2. **Physical Link & Channel Characteristics**
   * *Paper:* **"The Identification of Rogue Access Points Using Channel State Information"** — *(2023)*.
   * *Application:* Bypasses surface-level header spoofing by tracking line-of-sight signal propagation and underlying RF channel alterations.

3. **Statistical Anomaly & Feature Encoding**
   * *Paper:* **"SmartLens: Robust Detection Of Rogue Device Via Frequency Domain Features In LoRa-Enabled IIoT"** — *S. Halder et al. (IEEE CNS 2023)*.
   * *Application:* Encodes temporal beacon intervals and probe request frequencies into structured vector caches to isolate devices deviating from baseline operational behaviors.

---

## 🖥️ System Architecture

```
                       ┌─────────────────────────────────────┐
                       │       Project Phasor S3 Hardware     │
                       │   Freenove ESP32-S3 (8MB / 8MB)     │
                       └──────────────────┬──────────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
     ┌────────────────────────┐                      ┌────────────────────────┐
     │ 2.4 GHz Wi-Fi Radio    │                      │  BLE 5.0 Radio         │
     │ - Promiscuous Sniffing │                      │  - Active/Passive Scan │
     │ - EAPOL/PMKID Capture  │                      │  - Tracker Detection   │
     └───────────┬────────────┘                      └───────────┬────────────┘
                 │                                               │
                 └───────────────────────┬───────────────────────┘
                                         │ JSON / Serial Output (115200 Baud)
                                         ▼
                       ┌─────────────────────────────────────┐
                       │  React Web Serial Command Center    │
                       │  (Browser-Native / Zero-Backend)   │
                       └─────────────────────────────────────┘
```

---

## ✨ Features

- 🛰️ **Passive Spectrum Sweeping:** Captures 802.11 b/g/n SSIDs, BSSIDs, RSSI, channels, and security types (Open, WEP, WPA2, WPA3) without active broadcasting.
- 📡 **BLE Proximity Hunting:** Discovers smartwatches, AirTags, headphones, and IoT beacons in physical proximity.
- 🔐 **EAPOL & Handshake Monitoring:** Passive detection and assembly of WPA/WPA2 4-way handshakes (M1–M4) and PMKIDs for security audits.
- 🎯 **Client Network Mapping:** Traverses probe requests and station connections to map network topology.
- 💻 **Browser Command Center:** Zero-dependency React interface leveraging the native **Web Serial API** (`navigator.serial`) for real-time visualization and hardware control.

---

## 🛠️ Hardware Requirements & Pinout

* **Board:** Freenove ESP32-S3 Dev Module (N8R8) or equivalent ESP32-S3 board with PSRAM.
* **Connection:** USB-C plugged directly into the **Native USB** port (`COM12` on Windows / `/dev/ttyACM0` on Linux).
* **Storage (Optional Expansion):** Micro SD Card Breakout connected via SPI (`GPIO 10, 11, 12, 13`).

---

## 🚀 Quick Start Guide

### 1. ESP32-S3 Firmware Setup
1. Open **Arduino IDE 2.x**.
2. Go to **Preferences** and add the Espressif index URL:
   `https://espressif.github.io/arduino-esp32/package_esp32_index.json`
3. Install **esp32 by Espressif Systems** via Boards Manager.
4. Set hardware configuration:
   * **Board:** `ESP32S3 Dev Module`
   * **USB CDC On Boot:** `Enabled` *(Critical for Native USB communication)*
   * **Flash Size:** `8MB`
   * **PSRAM:** `OPI PSRAM`
5. Flash `Phasors3.ino` to the board.

### 2. Launching the React Command Center
```bash
# Clone the repository
git clone https://github.com/your-username/phasor-s3.git
cd phasor-s3/dashboard

# Install dependencies
npm install

# Start local development server
npm run dev
```
Open Chrome or Edge (browsers supporting Web Serial), click **Connect ESP32**, and select your device's COM port!

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## ⚠️ Disclaimer

*This project is designed strictly for educational purposes, academic research, and authorized enterprise security testing. Always obtain proper authorization before auditing target networks.*