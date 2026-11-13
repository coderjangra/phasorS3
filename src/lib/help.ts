// ============================================================================
// Central help / explanation content. Every InfoTip in the UI pulls its text
// from here by key, so copy stays consistent, accurate and non-sensational.
// Offensive actions always carry the "authorized testing only" note.
// ============================================================================

export const AUTHORIZED_ONLY =
  'Transmits real RF frames. Use only against networks and devices you own or are explicitly authorized to test.';

export const help: Record<string, string> = {
  // --- Views ---
  'view.overview':
    'The rogue-hunting home. Ranked threats from the analytics engine, live stat tiles, the 2.4 GHz spectrum and quick recon controls.',
  'view.wifi':
    'Every Wi-Fi access point seen, with risk scoring. Sort and filter the table, or click a row for per-AP detail and quick actions.',
  'view.bluetooth':
    'Bluetooth Low Energy devices observed nearby, with signal strength and a decoded device/tracker class where known.',
  'view.clients':
    'Client stations mapped to their access points, plus probe requests — the saved-network names devices broadcast while looking for Wi-Fi.',
  'view.captures':
    'WPA 4-way handshakes and PMKIDs captured. Complete handshakes can be exported in hashcat format for offline authorized analysis.',
  'view.attacks':
    'Active-RF testing tools: deauth, handshake forcing, PMKID, beacon flood and BLE flood. These transmit frames and commandeer the radio.',
  'view.log':
    'The full device event log, parsed into readable rows with a category, severity and a plain-English explanation of each line.',

  // --- Connection / mode ---
  'link.mode':
    'Live connects to a real Phasor-S3 over WebSocket. Demo runs a synthetic airspace so you can explore the dashboard and analytics with no hardware.',
  'link.pause':
    'Pause stops ingesting new telemetry into the dashboard. Already-captured data stays; the device keeps running. Resume to continue.',
  'link.status':
    'Connection to the active sensor: connecting, connected, or offline (auto-reconnecting every few seconds).',
  'link.events':
    'How recently the dashboard received an event from the device — a quick liveness check.',

  // --- Device modes ---
  'mode.strip':
    'The operating mode the device reports in its STATUS frame: Idle, Monitor, Continuous, Beacon Flood or BLE Flood.',
  'mode.monitor':
    'Promiscuous channel-hopping capture — harvests stations, probe requests, handshakes and deauth frames across all channels. The dashboard link may stutter or drop while hopping; it auto-reconnects. Use Continuous for steady telemetry, Monitor for deep capture.',
  'mode.continuous':
    'Repeated scanning for steady live telemetry while keeping the dashboard link stable. Good default for watching an airspace over time.',

  // --- Quick controls ---
  'cmd.scanWifi': 'One-shot active Wi-Fi scan. Populates the networks table.',
  'cmd.scanBle': 'One-shot BLE scan. Populates the Bluetooth list.',
  'cmd.fullSweep': 'Runs a Wi-Fi scan and a BLE scan back to back.',
  'cmd.status': 'Asks the device for a fresh STATUS frame (mode, uptime, memory, counts).',
  'cmd.clear':
    'Clears the device-side caches. The dashboard snapshot for this sensor is also cleared.',
  'cmd.export': 'Downloads the current session as a JSON snapshot for offline analysis.',

  // --- Stat tiles ---
  'stat.networks': 'Total Wi-Fi access points observed. "flagged" counts APs the engine scored as anomalous.',
  'stat.threats': 'Unacknowledged critical/serious alerts. These are the findings worth acting on first.',
  'stat.ble': 'Bluetooth Low Energy devices seen in range.',
  'stat.clients': 'Client-to-AP associations mapped, and how many clients are actively probing.',
  'stat.handshakes': 'Complete / total WPA handshakes captured, plus PMKID count.',
  'stat.device': 'The device operating mode, uptime and free heap from the latest STATUS frame.',

  // --- Panels ---
  'panel.threats':
    'Findings from the in-browser detection engine (evil-twin, auth-downgrade, multi-channel, unstable-RSSI, karma, probe-flood, deauth-flood), worst first.',
  'panel.spectrum':
    'Access points per 2.4 GHz channel. A red tick marks a channel hosting a flagged AP.',
  'panel.logDock': 'The most recent event-log lines. Open the full Event Log for filtering and search.',

  // --- Attacks ---
  'attack.deauth':
    `Broadcast deauthentication: forces clients off a target AP by spoofing deauth frames. A successful run disconnects associated clients (they usually reconnect). ${AUTHORIZED_ONLY}`,
  'attack.forceHs':
    `Force handshake: deauthenticates clients, then listens so the WPA 4-way handshake is re-captured when a client reconnects. Success = a complete handshake appears in Captures, crackable offline. ${AUTHORIZED_ONLY}`,
  'attack.pmkid':
    `PMKID capture: requests a PMKID from a WPA2 AP without needing a connected client. Success = a PMKID row in Captures. ${AUTHORIZED_ONLY}`,
  'attack.deauthTargeted':
    `Targeted deauthentication: disconnects one specific client from one specific AP, rather than all clients. ${AUTHORIZED_ONLY}`,
  'attack.bleFloodTarget':
    `BLE target flood: sprays advertisement packets at one BLE address, which can disrupt or spam that device. ${AUTHORIZED_ONLY}`,
  'attack.bleMassFlood':
    `BLE mass flood: broadcasts many spoofed BLE advertisements, which nearby phones may surface as pairing spam. ${AUTHORIZED_ONLY}`,
  'attack.bleStop': 'Stops any running BLE flood and returns the device to Idle.',

  // --- Beacon flow ---
  'beacon.flow':
    'Beacon flood broadcasts fake Wi-Fi network names. Order matters: load (or add) SSIDs first, then start — the device refuses to start with an empty list.',
  'beacon.load': 'Loads 5 built-in demo SSIDs into the beacon list so you have something to broadcast.',
  'beacon.add': 'Adds one custom SSID to the beacon list.',
  'beacon.start':
    `Starts broadcasting every SSID in the list as a fake AP. Disabled until at least one SSID is loaded. Success = spoofed networks appear to nearby devices. ${AUTHORIZED_ONLY}`,
  'beacon.stop': 'Stops the beacon flood and restores the dashboard SoftAP.',
  'beacon.clear': 'Empties the beacon SSID list.',

  // --- Sensors / fleet ---
  'fleet.switcher':
    'Your Phasor-S3 sensors. Switch the active sensor to reconnect the dashboard to its IP. Only the active sensor streams this pass.',
  'fleet.add': 'Add a sensor by name and IP address. Stored in your browser.',
  'fleet.persist':
    'Each sensor keeps its own snapshot in your browser, so networks, captures, alerts and log survive a page reload.',
};

export function helpText(key: string): string {
  return help[key] ?? '';
}
