# ⚡ Project Phasor S3

> An edge-computing wireless signal-intelligence & rogue-device detection appliance powered by the ESP32-S3, paired with a real-time React command center that connects over Wi-Fi + WebSocket and performs rogue-AP / anomaly analytics in the browser.

![Hardware Platform](https://img.shields.io/badge/Hardware-ESP32--S3%20(N8R8)-blue?style=for-the-badge&logo=espressif)
![Firmware](https://img.shields.io/badge/Firmware-C%2B%2B%20%2F%20Arduino-00599C?style=for-the-badge&logo=c%2B%2B)
![Frontend](https://img.shields.io/badge/Dashboard-React%20%2B%20MUI-61DAFB?style=for-the-badge&logo=react)
![Transport](https://img.shields.io/badge/Transport-Wi--Fi%20%2F%20WebSocket-emerald?style=for-the-badge)

---

## 📌 Executive Summary

**Project Phasor S3** packages 2.4 GHz 802.11 spectrum analysis, Bluetooth Low Energy (BLE)
proximity tracking, and EAPOL handshake monitoring into a compact, dual-core **Freenove
ESP32-S3 (N8R8)** appliance. The device exposes its own Wi-Fi access point and streams
structured telemetry over a WebSocket to a browser-based **React Command Center**, which runs
the project's rogue-AP and anomaly detection analytics live, on-device-independent, in the
browser.

Detection logic is grounded in peer-reviewed research — multi-subset RSSI spatial consistency,
channel/physical-layer characteristics, and temporal feature profiling — to isolate rogue APs,
evil twins, and spoofed endpoints rather than trusting easily-forged MAC addresses.

---

## 🔬 Theoretical Grounding

1. **Spatial Position Consistency** — *Liu & Papadimitratos (2024), "Position-based Rogue Access
   Point Detection."* The dashboard flags APs whose RSSI footprint is statistically inconsistent
   with a single fixed transmitter, and SSIDs cloned across multiple BSSIDs.
2. **Physical Link & Channel Characteristics** — *McGinniss (2023), "The Identification of Rogue
   Access Points Using Channel State Information."* A single BSSID beaconing across multiple
   channels, or an auth downgrade for a known SSID, is surfaced as a rogue indicator.
3. **Statistical / Temporal Feature Profiling** — *Halder et al., "SmartLens" (IEEE CNS 2023).*
   Probe-request fan-out and deauthentication-frame bursts are profiled against baseline behavior
   to raise probe-flood, karma, and deauth-flood alerts.

These are implemented in `src/lib/analytics.ts` and run continuously over the live telemetry.

---

## 🖥️ System Architecture

```
          ┌───────────────────────────────────────────────┐
          │            Project Phasor S3 (ESP32-S3)        │
          │   2.4 GHz Wi-Fi radio  ·  BLE 5  ·  USB-HID    │
          │   Promiscuous sniffing · EAPOL/PMKID capture   │
          └───────────────┬───────────────────────────────┘
                          │  SoftAP "Phasor-S3" @ 192.168.4.1
                          │  WebSocket  ws://192.168.4.1/ws   { type, payload }
                          │  Commands   WS text frame / POST /cmd
                          ▼
          ┌───────────────────────────────────────────────┐
          │        React Command Center (browser)          │
          │  Rogue-AP / evil-twin / deauth analytics       │
          │  Spectrum · RSSI timelines · threat feed        │
          │  Handshake export · session recording · demo   │
          └───────────────────────────────────────────────┘
```

See **[PROTOCOL.md](./PROTOCOL.md)** for the full event/command contract.

---

## ✨ Features

### Firmware (`PhasorS3.ino`)
- 🛰️ **Passive spectrum sweeping** — SSID/BSSID/RSSI/channel/auth enumeration.
- 📡 **BLE proximity hunting** — active & passive scans.
- 🔐 **EAPOL & PMKID monitoring** — assembles WPA/WPA2 4-way handshakes (M1–M4).
- 🎯 **Client network mapping** — probe requests + station↔AP associations.
- 🌐 **Wi-Fi command center** — SoftAP + `AsyncWebServer` + WebSocket streaming the
  `{type,payload}` contract, plus the original interactive serial CLI (both work in parallel).
- 🧰 Active RF tooling (deauth, beacon flood, BLE flood, USB-HID) for **authorized** testing.

### Dashboard (`src/`)
- 🚨 **Threat feed** — evil-twin, auth-downgrade, multi-channel, unstable-RSSI, karma,
  probe-flood and deauth-flood detection, each with a severity and a "why flagged" explanation.
- 📊 **2.4 GHz spectrum** — channel-occupancy chart; **RSSI timelines** per AP/BLE device.
- 🗂️ **Live panels** — sortable/searchable Wi-Fi, BLE, probes, client-map, captures, sensors.
- 🔎 **Device drawer** — per-AP signal footprint, associated clients, quick deauth/force-HS.
- 💾 **Export** — handshakes (hashcat format), PMKIDs, alerts (CSV), full session (JSON).
- 🧪 **Demo mode** — a built-in simulator drives the whole UI with synthetic telemetry, so you
  can explore and present the analytics with no hardware attached.

---

## 🛠️ Hardware

* **Board:** Freenove ESP32-S3 Dev Module (N8R8) or equivalent ESP32-S3 with PSRAM.
* **Connection:** USB-C to the **Native USB** port for flashing / serial CLI.
* **Storage (optional):** micro-SD via SPI (`GPIO 10/11/12/13`).

---

## 🚀 Quick Start

### 1. Flash the firmware
1. Arduino IDE 2.x → add the Espressif board index and install **esp32 by Espressif Systems**.
2. Install libraries: **ESPAsyncWebServer** (me-no-dev fork) + **AsyncTCP**, and **ArduinoJson** (v7).
3. Board config: `ESP32S3 Dev Module`, **USB CDC On Boot: Enabled**, Flash `8MB`, PSRAM `OPI PSRAM`.
4. Flash `PhasorS3.ino`.

### 2. Launch the Command Center
```bash
npm install
npm run dev
```
- **With hardware:** join the device's Wi-Fi AP (`Phasor-S3` / `phasor123`), open the dashboard,
  keep mode **Live**, and confirm the device IP is `192.168.4.1`.
- **Without hardware:** switch the header toggle to **Demo** to drive the UI from the simulator.

> ⚠️ **Single-radio note:** monitor-mode channel hopping and active RF attacks temporarily take
> over the radio and can drop the dashboard link (it auto-reconnects). Use *Continuous* scan for
> steady live telemetry. See [PROTOCOL.md](./PROTOCOL.md#single-radio-coexistence-important).

---

## 📂 Project Layout

```
PhasorS3.ino            ESP32-S3 firmware (CLI + SoftAP/WebSocket command center)
PROTOCOL.md             Event / command wire contract
src/
  types.ts              Shared data model + EventType contract
  lib/analytics.ts      Rogue-AP / anomaly detection engine (the academic core)
  lib/store.ts          Deduplicated, capped telemetry caches
  lib/protocol.ts       WebSocket frame decode
  lib/simulator.ts      Demo-mode synthetic telemetry
  hooks/usePhasorLink.ts Live WebSocket + demo pipeline + command sender
  components/           Header, StatCards, AlertFeed, ControlToolbar, panels, charts, drawer
```

---

## 📝 License & Disclaimer

Distributed under the MIT License.

*For educational purposes, academic research, and **authorized** security testing only. Always
obtain proper authorization before auditing any network or device.*
