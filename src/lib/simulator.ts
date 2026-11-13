// ============================================================================
// Demo / simulator mode. Emits a lively synthetic airspace so the dashboard and
// its analytics work with no hardware attached — useful for development and for
// demonstrating the detection engine (every alert class is exercised here).
// ============================================================================
import { EventType } from '../types';
import type { DecodedEvent } from './store';

export type Emit = (ev: DecodedEvent) => void;

function rnd(min: number, max: number) {
  return min + Math.random() * (max - min);
}
function jitter(base: number, amt: number) {
  return Math.round(base + rnd(-amt, amt));
}
function randMac(prefix?: string) {
  const o = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase();
  if (prefix) return `${prefix}:${o()}:${o()}:${o()}`;
  return `${o()}:${o()}:${o()}:${o()}:${o()}:${o()}`;
}

interface SimAp {
  ssid: string;
  bssid: string;
  base: number; // nominal rssi
  jit: number; // rssi jitter amplitude
  chan: number;
  auth: string;
  hop?: number[]; // if set, cycles channels (multi-channel anomaly)
}

export function createSimulator(emit: Emit, getMode: () => number = () => 1) {
  // --- A believable fixed baseline of legitimate APs (stable RSSI) ---
  const legit: SimAp[] = [
    { ssid: 'CorpNet', bssid: 'A4:5E:60:11:22:01', base: -48, jit: 2, chan: 1, auth: 'WPA2' },
    { ssid: 'CorpNet-Guest', bssid: 'A4:5E:60:11:22:02', base: -54, jit: 2, chan: 6, auth: 'WPA2' },
    { ssid: 'Eng-5G', bssid: 'B0:39:56:AA:01:10', base: -61, jit: 3, chan: 11, auth: 'WPA3' },
    { ssid: 'Lab-IoT', bssid: '3C:71:BF:40:09:7A', base: -70, jit: 3, chan: 6, auth: 'WPA2' },
    { ssid: 'Cafeteria', bssid: 'F0:9F:C2:88:12:30', base: -66, jit: 3, chan: 1, auth: 'WPA2' },
    { ssid: 'Printers', bssid: '00:1B:63:84:45:E6', base: -73, jit: 2, chan: 11, auth: 'WPA2' },
    { ssid: 'Reception', bssid: 'D8:47:32:9C:AA:04', base: -58, jit: 2, chan: 3, auth: 'WPA/WPA2' },
  ];

  // --- Threats, each designed to trip a specific detector ---
  // Evil twin of CorpNet, OPEN auth on a randomized BSSID => evil-twin + auth-downgrade + randomized.
  const evilTwin: SimAp = { ssid: 'CorpNet', bssid: '1A:11:22:33:44:55', base: -52, jit: 11, chan: 8, auth: 'OPEN' };
  // Multi-channel rogue (same BSSID, different channel each sweep).
  const hopper: SimAp = { ssid: 'FreeWiFi', bssid: '0E:AA:BB:CC:DD:01', base: -60, jit: 9, chan: 1, auth: 'OPEN', hop: [1, 6, 11] };
  let hopIdx = 0;

  const karmaClient = randMac('DE'); // locally-administered client
  const karmaSsids = ['CorpNet', 'HomeWiFi', 'Starbucks WiFi', 'Airport_Free', 'xfinitywifi', 'TP-Link_8822', 'AndroidAP', 'HotelGuest', 'Lab-IoT'];

  const bleDevices = [
    { addr: randMac(), name: 'AirPods Pro', base: -62 },
    { addr: randMac(), name: 'Galaxy Watch', base: -71 },
    { addr: randMac(), name: '', base: -80, company: 'Apple (FindMy / AirTag)' },
    { addr: randMac(), name: 'Mi Band 7', base: -68 },
    { addr: randMac(), name: 'JBL Flip 6', base: -75 },
  ];

  const hsKey = { ap: 'A4:5E:60:11:22:01', sta: randMac('AC'), chan: 1 };
  let hsStage = 0;
  const hexN = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');

  let uptime = 42;
  const timers: number[] = [];

  function emitScan() {
    const all = [...legit, evilTwin, hopper];
    if (hopper.hop) hopper.chan = hopper.hop[hopIdx++ % hopper.hop.length];
    const networks = all.map((ap) => ({
      ssid: ap.ssid,
      bssid: ap.bssid,
      rssi: jitter(ap.base, ap.jit),
      chan: ap.chan,
      auth: ap.auth,
    }));
    emit({ type: EventType.WIFI_SCAN, payload: { networks }, t: Date.now() });
  }

  function emitBle() {
    const devices = bleDevices.map((d) => ({
      addr: d.addr,
      name: d.name,
      rssi: jitter(d.base, 4),
      company: d.company,
    }));
    emit({ type: EventType.BLE_SCAN, payload: { devices }, t: Date.now() });
  }

  function emitProbe() {
    // Normal clients.
    emit({
      type: EventType.PROBE,
      payload: { mac: randMac(), ssid: Math.random() > 0.5 ? '' : ['CorpNet', 'Lab-IoT', 'Cafeteria'][Math.floor(rnd(0, 3))], rssi: jitter(-72, 8), chan: [1, 6, 11][Math.floor(rnd(0, 3))] },
      t: Date.now(),
    });
    // Karma client cycling many SSIDs.
    emit({
      type: EventType.PROBE,
      payload: { mac: karmaClient, ssid: karmaSsids[Math.floor(rnd(0, karmaSsids.length))], rssi: jitter(-58, 5), chan: 6 },
      t: Date.now(),
    });
  }

  function emitStation() {
    const ap = legit[Math.floor(rnd(0, legit.length))];
    emit({
      type: EventType.STATION,
      payload: { ap: ap.bssid, sta: randMac(), rssi: jitter(-69, 10), chan: ap.chan },
      t: Date.now(),
    });
  }

  function emitHandshake() {
    hsStage = (hsStage % 4) + 1;
    const p: any = { ap: hsKey.ap, sta: hsKey.sta, chan: hsKey.chan, rssi: -57 };
    p.m1 = hsStage >= 1;
    p.m2 = hsStage >= 2;
    p.m3 = hsStage >= 3;
    p.m4 = hsStage >= 4;
    p.complete = hsStage >= 3;
    if (hsStage >= 3) {
      p.anonce = hexN(32);
      p.snonce = hexN(32);
      p.mic = hexN(16);
      p.ssid = 'CorpNet';
    }
    emit({ type: EventType.HANDSHAKE, payload: p, t: Date.now() });
  }

  function emitStatus() {
    uptime += 3;
    emit({
      type: EventType.STATUS,
      payload: {
        mode: getMode(),
        uptime,
        heap: jitter(210000, 8000),
        psram: jitter(7900000, 4000),
        handshakes: 1,
        complete: hsStage >= 3 ? 1 : 0,
        stations: 6,
        probes: 14,
        beacons: 0,
        fw: '3.1.0-Web',
      },
      t: Date.now(),
    });
  }

  let deauthPhase = 0;
  function maybeDeauth() {
    // After a while, launch a deauth burst to trip the flood detector, then quiet.
    deauthPhase++;
    if (deauthPhase % 12 < 4) {
      for (let i = 0; i < 5; i++) {
        emit({
          type: EventType.DEAUTH_RX,
          payload: { ap: evilTwin.bssid, sta: 'FF:FF:FF:FF:FF:FF', reason: 7, chan: evilTwin.chan },
          t: Date.now(),
        });
      }
    }
  }

  function start() {
    emit({ type: EventType.LOG, payload: { msg: '[SIM] Demo airspace online — synthetic telemetry', level: 'info' }, t: Date.now() });
    emitScan();
    emitBle();
    emitStatus();
    timers.push(window.setInterval(emitScan, 4000));
    timers.push(window.setInterval(emitBle, 7000));
    timers.push(window.setInterval(emitProbe, 1300));
    timers.push(window.setInterval(emitStation, 2100));
    timers.push(window.setInterval(emitHandshake, 2600));
    timers.push(window.setInterval(emitStatus, 3000));
    timers.push(window.setInterval(maybeDeauth, 2500));
  }

  function stop() {
    timers.forEach((id) => clearInterval(id));
    timers.length = 0;
  }

  return { start, stop };
}

// ----------------------------------------------------------------------------
// Demo command simulation. In demo mode usePhasorLink.send() routes here so the
// user SEES testing features work with no hardware: deauth bursts, beacon
// floods, BLE floods and mode changes all produce synthetic events + log lines.
// ----------------------------------------------------------------------------
export interface SimCommandCtx {
  getMode: () => number;
  setMode: (m: number) => void;
  beaconLoaded: () => boolean;
  setBeaconLoaded: (b: boolean) => void;
}

export interface SimCommandResult {
  ok: boolean;
  warning?: string;
}

const BEACON_FAKE_SSIDS = ['FreeAirport_WiFi', 'Starbucks Guest', 'xfinitywifi', 'Hotel_Lobby', 'Netgear_Setup'];

function log(emit: Emit, msg: string, level: 'info' | 'warning' | 'serious' | 'good' = 'info') {
  emit({ type: EventType.LOG, payload: { msg, level }, t: Date.now() });
}

function emitSimStatus(emit: Emit, mode: number) {
  emit({
    type: EventType.STATUS,
    payload: {
      mode,
      uptime: Math.floor(performance.now() / 1000) + 42,
      heap: jitter(210000, 8000),
      psram: jitter(7900000, 4000),
      handshakes: 1,
      complete: 1,
      stations: 6,
      probes: 14,
      beacons: mode === 3 ? BEACON_FAKE_SSIDS.length : 0,
      fw: '3.1.0-Web',
    },
    t: Date.now(),
  });
}

export function simulateCommand(cmd: string, emit: Emit, ctx: SimCommandCtx): SimCommandResult {
  const c = cmd.trim();
  const p = c.split(/\s+/);
  const head = p[0];

  switch (head) {
    case '1':
      log(emit, '[CMD] Wi-Fi scan triggered');
      return { ok: true };
    case '2':
      log(emit, '[CMD] BLE scan triggered');
      return { ok: true };
    case '3':
      log(emit, '[CMD] full sweep triggered');
      return { ok: true };
    case '4': {
      const next = ctx.getMode() === 2 ? 0 : 2;
      ctx.setMode(next);
      emitSimStatus(emit, next);
      log(emit, `[CMD] Continuous mode ${next === 2 ? 'ON' : 'OFF'}`);
      return { ok: true };
    }
    case '5': {
      const next = ctx.getMode() === 1 ? 0 : 1;
      ctx.setMode(next);
      emitSimStatus(emit, next);
      log(emit, `[CMD] Monitor mode ${next === 1 ? 'ON — hopping channels' : 'OFF'}`);
      return { ok: true };
    }
    case '6':
      log(emit, '[CMD] passive BLE toggled');
      return { ok: true };
    case '7':
      emitSimStatus(emit, ctx.getMode());
      log(emit, '[CMD] status');
      return { ok: true };
    case 'C':
      log(emit, '[CMD] device caches cleared');
      return { ok: true };
    case 'E':
      log(emit, '[CMD] exported complete handshakes');
      return { ok: true };

    case 'DB':
    case 'DS':
    case 'DF': {
      const ap = head === 'DS' ? p[1] : p[1];
      const sta = head === 'DS' ? p[2] : 'FF:FF:FF:FF:FF:FF';
      const chan = head === 'DS' ? Number(p[3] || 6) : Number(p[2] || 6);
      log(emit, `[DEAUTH] ${head === 'DF' ? 'force-handshake' : 'broadcast'} → ${ap || '?'} reason 7`, 'warning');
      for (let i = 0; i < 6; i++) {
        emit({
          type: EventType.DEAUTH_RX,
          payload: { ap: (ap || '').toUpperCase(), sta, reason: 7, chan },
          t: Date.now(),
        });
      }
      if (head === 'DF' && ap) {
        // Advance a handshake capture: a client reconnects and we grab all four messages.
        const sim_sta = randMac('AC');
        const hex = (n: number) =>
          Array.from({ length: n }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
        emit({
          type: EventType.HANDSHAKE,
          payload: {
            ap: ap.toUpperCase(),
            sta: sim_sta,
            chan,
            rssi: -57,
            m1: true,
            m2: true,
            m3: true,
            m4: true,
            complete: true,
            anonce: hex(32),
            snonce: hex(32),
            mic: hex(16),
            ssid: 'CorpNet',
          },
          t: Date.now(),
        });
        log(emit, `[EAPOL] 4-way handshake message 3 captured for ${ap} — complete`, 'good');
      }
      return { ok: true };
    }

    case 'PM':
    case 'PS': {
      const ap = (p[1] || '').toUpperCase();
      const chan = head === 'PS' ? Number(p[3] || 6) : Number(p[2] || 6);
      const hex = (n: number) =>
        Array.from({ length: n }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
      emit({
        type: EventType.PM_KID,
        payload: { ap, chan, pmkid: hex(16), ssid: head === 'PS' ? p[2] : undefined },
        t: Date.now(),
      });
      log(emit, `[PMKID] captured from ${ap || '?'}`, 'serious');
      return { ok: true };
    }

    case 'BR':
      ctx.setBeaconLoaded(true);
      log(emit, '[BEACON] beacon list loaded (5 SSIDs)');
      return { ok: true };
    case 'BC':
      ctx.setBeaconLoaded(false);
      if (ctx.getMode() === 3) {
        ctx.setMode(0);
        emitSimStatus(emit, 0);
      }
      log(emit, '[BEACON] list cleared');
      return { ok: true };
    case 'BS':
      if (ctx.getMode() === 3) {
        ctx.setMode(0);
        emitSimStatus(emit, 0);
      }
      log(emit, '[BEACON] flood stopped — SoftAP restored');
      return { ok: true };
    case 'BA': {
      if (p.length > 1) {
        ctx.setBeaconLoaded(true);
        log(emit, `[BEACON] SSID added: ${p.slice(1).join(' ')}`);
        return { ok: true };
      }
      // bare BA = start flood (firmware requires a non-empty list)
      if (!ctx.beaconLoaded()) {
        log(emit, '[BEACON] no SSIDs loaded — run Beacon Load first', 'warning');
        return { ok: false, warning: 'No SSIDs loaded — run Beacon Load first' };
      }
      ctx.setMode(3);
      emitSimStatus(emit, 3);
      const networks = BEACON_FAKE_SSIDS.map((ssid) => ({
        ssid,
        bssid: randMac('1A'), // locally-administered => trips randomized-bssid
        rssi: jitter(-55, 6),
        chan: [1, 6, 11][Math.floor(rnd(0, 3))],
        auth: 'OPEN',
      }));
      emit({ type: EventType.WIFI_SCAN, payload: { networks }, t: Date.now() });
      log(emit, '[BEACON] flood started — broadcasting fake SSIDs', 'warning');
      return { ok: true };
    }

    case 'F1':
    case 'F2':
      ctx.setMode(4);
      emitSimStatus(emit, 4);
      log(emit, `[BLE] advertisement flood started (${head === 'F1' ? `target ${p[1] || '?'}` : 'mass'})`, 'warning');
      return { ok: true };
    case 'FS':
      if (ctx.getMode() === 4) {
        ctx.setMode(0);
        emitSimStatus(emit, 0);
      }
      log(emit, '[BLE] flood stopped');
      return { ok: true };

    default:
      log(emit, `[CMD] ${c}`);
      return { ok: true };
  }
}
