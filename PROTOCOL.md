# Phasor-S3 Wire Protocol

The firmware and the React dashboard talk over **WebSocket** (telemetry, device → browser)
and **single-line commands** (browser → device, over the same socket or `POST /cmd`).

## Transport

| Channel | Direction | Purpose |
|---|---|---|
| SoftAP `Phasor-S3` (`192.168.4.1`) | — | Device access point the browser joins |
| `ws://<device-ip>/ws` | device → browser | Live event stream |
| WebSocket text frame | browser → device | Command (one line) |
| `GET`/`POST http://<device-ip>/cmd?c=<line>` | browser → device | Command (HTTP fallback, CORS-open) |
| `GET /` | — | Minimal landing page |

Default AP credentials live in `PhasorS3.ino` (`AP_SSID` / `AP_PASS`). Change them before field use.

## Events (device → browser)

Every frame is a JSON object:

```json
{ "type": <number>, "payload": { ... } }
```

`type` is the `EventType` enum (shared with `src/types.ts`):

| # | Name | Payload |
|---|------|---------|
| 1 | `WIFI_SCAN` | `{ networks: [{ ssid, bssid, rssi, chan, auth }] }` |
| 2 | `BLE_SCAN` | `{ devices: [{ addr, name, rssi, company? }] }` |
| 3 | `PROBE` | `{ mac, ssid, rssi, chan }` |
| 4 | `DEAUTH_RX` | `{ ap, sta, reason, chan }` |
| 5 | `HANDSHAKE` | `{ ap, sta, chan, rssi, m1, m2, m3, m4, complete, anonce?, snonce?, mic?, ssid? }` |
| 6 | `PM_KID` | `{ ap, chan, pmkid, ssid? }` |
| 7 | `STATION` | `{ ap, sta, rssi, chan }` |
| 8 | `LOG` | `{ msg, level? }` |
| 9–12 | `IR_RX` / `RFID_RX` / `IBUTTON_RX` / `SUBGHZ_RX` | sensor value |
| 13 | `STATUS` | `{ mode, uptime, heap, psram, handshakes, complete, stations, probes, beacons, fw }` |

The dashboard also accepts an **array** of frames and the legacy string-typed shape
(`{ "type": "wifi_scan", "wifi": [...] }`) for backward compatibility — see `src/lib/protocol.ts`.

Telemetry cadence: scans emit immediately; the promiscuous engine's probe/station/handshake
deltas plus a `STATUS` frame are flushed from `loop()` (`flushTelemetry`, ~every iteration,
`STATUS` every `STATUS_EMIT_MS`). Deauth frames captured in the ISR-context callback are queued
in a lock-free ring and flushed from `loop()`.

## Commands (browser → device)

Single line, case-sensitive. Sent as a WebSocket text frame or `?c=`.

| Command | Action |
|---|---|
| `1` / `2` / `3` | Wi-Fi scan / BLE scan / full sweep |
| `4` / `5` / `6` | toggle continuous / toggle monitor / passive BLE |
| `7` | status (emits a `STATUS` frame) |
| `C` | clear all device caches |
| `E` | emit complete handshakes as `WPA*01*…` log lines |
| `DB <bssid> <ch> <n>` | broadcast deauth |
| `DS <ap> <sta> <ch>` | targeted deauth |
| `DF <bssid> <ch> <sec>` | force-handshake (deauth + capture) |
| `PM <bssid> <ch>` / `PS <bssid> <ssid> <ch>` | PMKID attempt |
| `BR` / `BA <ssid>` / `BA` / `BS` / `BC` | beacon: load defaults / add / start / stop / clear |
| `F1 <mac> <n>` / `F2 <n>` / `FS` | BLE flood target / mass / stop |
| `K1` / `K2` | USB-HID payloads (requires TinyUSB build) |

## Single-radio coexistence (important)

The ESP32-S3 has one 2.4 GHz radio. The dashboard SoftAP, promiscuous sniffing and the RF
attacks all contend for it:

- **Recon scans** (`1`/`2`/`3`) run in `WIFI_AP_STA`, so the SoftAP — and the dashboard link —
  survive them (a brief stutter is possible).
- **Monitor mode** (`5`) hops channels; because the SoftAP channel follows the radio, the
  browser link will intermittently drop and auto-reconnect. Prefer **Continuous** (`4`) for
  steady live telemetry; use Monitor for deep capture when link stutter is acceptable.
- **Active RF attacks** (deauth / beacon flood / BLE flood / PMKID) temporarily commandeer the
  radio and will drop the dashboard link until they finish; the dashboard reconnects afterward.

## Firmware library dependencies

- [`ESPAsyncWebServer`](https://github.com/mathieucarbou/ESPAsyncWebServer) (me-no-dev fork) + `AsyncTCP`
- `ArduinoJson` (v7)
- `arduino-esp32` core (BLE, `esp_wifi`)
