// ============================================================================
// Pure state reducer. Ingests decoded firmware events and maintains the
// deduplicated, capped caches that the UI renders. Analytics (alerts / rogue
// scoring) run separately over the resulting state (see analytics.ts).
// ============================================================================
import {
  EventType,
  PhasorState,
  WifiNetwork,
  BleDevice,
  ProbeDevice,
  Station,
  Handshake,
  Pmkid,
  DeauthEvent,
  LogLine,
  DeviceStatus,
  Severity,
  RssiSample,
} from '../types';

export const MAX_RSSI_HISTORY = 120;
const MAX_LOGS = 500;
const MAX_DEAUTHS = 400;
const MAX_PMKIDS = 200;

export interface DecodedEvent {
  type: EventType;
  payload: any;
  t: number;
}

function pushHistory(hist: RssiSample[], t: number, rssi: number): RssiSample[] {
  if (rssi === undefined || rssi === null || !Number.isFinite(rssi)) return hist;
  const next = hist.length >= MAX_RSSI_HISTORY ? hist.slice(hist.length - MAX_RSSI_HISTORY + 1) : hist.slice();
  next.push({ t, rssi });
  return next;
}

function uniqPush<T>(arr: T[], v: T): T[] {
  if (v === undefined || v === null) return arr;
  return arr.includes(v) ? arr : [...arr, v];
}

function upsertWifi(wifi: Record<string, WifiNetwork>, raw: any, t: number, sid?: string): WifiNetwork {
  const bssid = String(raw.bssid || '').toUpperCase();
  const prev = wifi[bssid];
  const ssid = raw.ssid ?? prev?.ssid ?? '';
  const chan = Number(raw.chan ?? raw.channel ?? prev?.chan ?? 0);
  const auth = String(raw.auth ?? prev?.auth ?? 'UNK');
  const rssi = Number(raw.rssi ?? prev?.rssi ?? -100);
  const net: WifiNetwork = {
    bssid,
    ssid,
    rssi,
    chan,
    auth,
    firstSeen: prev?.firstSeen ?? t,
    lastSeen: t,
    seenCount: (prev?.seenCount ?? 0) + 1,
    channels: uniqPush(prev?.channels ?? [], chan),
    auths: uniqPush(prev?.auths ?? [], auth),
    rssiHistory: pushHistory(prev?.rssiHistory ?? [], t, rssi),
    rogueScore: prev?.rogueScore ?? 0,
    flags: prev?.flags ?? [],
    sensorId: sid ?? prev?.sensorId,
  };
  return net;
}

function upsertBle(ble: Record<string, BleDevice>, raw: any, t: number, sid?: string): BleDevice {
  const addr = String(raw.addr || raw.mac || '').toUpperCase();
  const prev = ble[addr];
  const rssi = Number(raw.rssi ?? prev?.rssi ?? -100);
  return {
    addr,
    name: raw.name && raw.name !== '<Unknown>' ? raw.name : prev?.name || raw.name || '',
    rssi,
    firstSeen: prev?.firstSeen ?? t,
    lastSeen: t,
    seenCount: (prev?.seenCount ?? 0) + 1,
    rssiHistory: pushHistory(prev?.rssiHistory ?? [], t, rssi),
    company: raw.company ?? prev?.company,
    sensorId: sid ?? prev?.sensorId,
  };
}

export function applyEvent(state: PhasorState, ev: DecodedEvent, sid?: string): PhasorState {
  const { type, payload, t } = ev;
  const s: PhasorState = { ...state, eventCount: state.eventCount + 1, lastEventAt: t };

  switch (type) {
    case EventType.WIFI_SCAN: {
      const list: any[] = payload?.networks || payload?.wifi || [];
      const wifi = { ...s.wifi };
      for (const raw of list) {
        if (!raw?.bssid) continue;
        const net = upsertWifi(wifi, raw, t, sid);
        wifi[net.bssid] = net;
      }
      s.wifi = wifi;
      break;
    }
    case EventType.BLE_SCAN: {
      const list: any[] = payload?.devices || payload?.ble || (payload?.addr || payload?.mac ? [payload] : []);
      const ble = { ...s.ble };
      for (const raw of list) {
        const addr = String(raw.addr || raw.mac || '').toUpperCase();
        if (!addr) continue;
        ble[addr] = upsertBle(ble, raw, t, sid);
      }
      s.ble = ble;
      break;
    }
    case EventType.PROBE: {
      const mac = String(payload.mac || '').toUpperCase();
      if (!mac) break;
      const prev = s.probes[mac];
      const ssid = payload.ssid || '';
      const probe: ProbeDevice = {
        mac,
        ssid: ssid || prev?.ssid || '',
        rssi: Number(payload.rssi ?? prev?.rssi ?? -100),
        chan: Number(payload.chan ?? prev?.chan ?? 0),
        firstSeen: prev?.firstSeen ?? t,
        lastSeen: t,
        seenCount: (prev?.seenCount ?? 0) + 1,
        ssids: ssid ? uniqPush(prev?.ssids ?? [], ssid) : prev?.ssids ?? [],
        sensorId: sid ?? prev?.sensorId,
      };
      s.probes = { ...s.probes, [mac]: probe };
      break;
    }
    case EventType.STATION: {
      const ap = String(payload.ap || '').toUpperCase();
      const sta = String(payload.sta || '').toUpperCase();
      if (!ap || !sta) break;
      const key = `${ap}_${sta}`;
      const prev = s.stations[key];
      const station: Station = {
        key,
        ap,
        sta,
        rssi: Number(payload.rssi ?? prev?.rssi ?? -100),
        chan: Number(payload.chan ?? prev?.chan ?? 0),
        firstSeen: prev?.firstSeen ?? t,
        lastSeen: t,
        seenCount: (prev?.seenCount ?? 0) + 1,
        sensorId: sid ?? prev?.sensorId,
      };
      s.stations = { ...s.stations, [key]: station };
      break;
    }
    case EventType.HANDSHAKE: {
      const ap = String(payload.ap || '').toUpperCase();
      const sta = String(payload.sta || '').toUpperCase();
      if (!ap || !sta) break;
      const key = `${ap}_${sta}`;
      const prev = s.handshakes[key];
      const m1 = Boolean(payload.m1 ?? prev?.m1);
      const m2 = Boolean(payload.m2 ?? prev?.m2);
      const m3 = Boolean(payload.m3 ?? prev?.m3);
      const m4 = Boolean(payload.m4 ?? prev?.m4);
      const hs: Handshake = {
        key,
        ap,
        sta,
        chan: Number(payload.chan ?? prev?.chan ?? 0),
        rssi: payload.rssi ?? prev?.rssi,
        m1,
        m2,
        m3,
        m4,
        complete: Boolean(payload.complete) || (m1 && m2 && m3) || (m2 && m3),
        anonce: payload.anonce ?? prev?.anonce,
        snonce: payload.snonce ?? prev?.snonce,
        mic: payload.mic ?? prev?.mic,
        ssid: payload.ssid ?? prev?.ssid,
        firstSeen: prev?.firstSeen ?? t,
        lastSeen: t,
        sensorId: sid ?? prev?.sensorId,
      };
      s.handshakes = { ...s.handshakes, [key]: hs };
      break;
    }
    case EventType.PM_KID: {
      const pmkid: Pmkid = {
        ap: String(payload.ap || '').toUpperCase(),
        chan: Number(payload.chan ?? 0),
        pmkid: payload.pmkid || '',
        ssid: payload.ssid,
        t,
        sensorId: sid,
      };
      s.pmkids = [pmkid, ...s.pmkids].slice(0, MAX_PMKIDS);
      break;
    }
    case EventType.DEAUTH_RX: {
      const d: DeauthEvent = {
        ap: String(payload.ap || '').toUpperCase(),
        sta: String(payload.sta || '').toUpperCase(),
        reason: Number(payload.reason ?? 0),
        chan: Number(payload.chan ?? 0),
        t,
        sensorId: sid,
      };
      s.deauths = [d, ...s.deauths].slice(0, MAX_DEAUTHS);
      break;
    }
    case EventType.LOG: {
      const line: LogLine = {
        t,
        msg: String(payload.msg ?? payload ?? ''),
        level: (payload.level as Severity) || 'info',
      };
      s.logs = [...s.logs, line].slice(-MAX_LOGS);
      break;
    }
    case EventType.IR_RX:
      s.sensors = { ...s.sensors, ir: String(payload.code ?? payload) };
      break;
    case EventType.RFID_RX:
      s.sensors = { ...s.sensors, rfid: String(payload.uid ?? payload) };
      break;
    case EventType.IBUTTON_RX:
      s.sensors = { ...s.sensors, ibutton: String(payload.uid ?? payload) };
      break;
    case EventType.SUBGHZ_RX:
      s.sensors = { ...s.sensors, subghz: String(payload.raw ?? payload) };
      break;
    case EventType.STATUS: {
      const st: DeviceStatus = {
        mode: Number(payload.mode ?? 0),
        uptime: Number(payload.uptime ?? 0),
        heap: Number(payload.heap ?? 0),
        psram: Number(payload.psram ?? 0),
        handshakes: Number(payload.handshakes ?? 0),
        complete: Number(payload.complete ?? 0),
        stations: Number(payload.stations ?? 0),
        probes: Number(payload.probes ?? 0),
        beacons: Number(payload.beacons ?? 0),
        fwVersion: String(payload.fw ?? payload.fwVersion ?? ''),
        t,
      };
      s.status = st;
      break;
    }
    default:
      break;
  }
  return s;
}

export function applyBatch(state: PhasorState, events: DecodedEvent[], sid?: string): PhasorState {
  return events.reduce((acc, ev) => applyEvent(acc, ev, sid), state);
}
