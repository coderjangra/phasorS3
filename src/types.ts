// ============================================================================
// Phasor-S3 shared data model
// The EventType enum is the wire contract between firmware (AsyncWebSocket) and
// this dashboard. Firmware pushes frames shaped { type: <EventType>, payload }.
// ============================================================================

export enum EventType {
  WIFI_SCAN = 1,
  BLE_SCAN = 2,
  PROBE = 3,
  DEAUTH_RX = 4,
  HANDSHAKE = 5,
  PM_KID = 6,
  STATION = 7,
  LOG = 8,
  IR_RX = 9,
  RFID_RX = 10,
  IBUTTON_RX = 11,
  SUBGHZ_RX = 12,
  STATUS = 13,
}

export type Severity = 'critical' | 'serious' | 'warning' | 'good' | 'info';

export interface RssiSample {
  t: number;
  rssi: number;
}

export interface WifiNetwork {
  bssid: string;
  ssid: string;
  rssi: number;
  chan: number;
  auth: string;
  firstSeen: number;
  lastSeen: number;
  seenCount: number;
  channels: number[]; // every channel this BSSID has been observed on
  auths: string[]; // every auth mode this BSSID has advertised
  rssiHistory: RssiSample[];
  /** Populated by the analytics engine. */
  rogueScore: number;
  flags: string[];
  /** Fleet readiness: which sensor observed this record (active sensor by default). */
  sensorId?: string;
}

export interface BleDevice {
  addr: string;
  name: string;
  rssi: number;
  firstSeen: number;
  lastSeen: number;
  seenCount: number;
  rssiHistory: RssiSample[];
  company?: string; // decoded manufacturer / tracker class when known
  sensorId?: string;
}

export interface ProbeDevice {
  mac: string;
  ssid: string;
  rssi: number;
  chan: number;
  firstSeen: number;
  lastSeen: number;
  seenCount: number;
  ssids: string[]; // distinct SSIDs this client has probed for
  sensorId?: string;
}

export interface Station {
  key: string; // `${ap}_${sta}`
  ap: string;
  sta: string;
  rssi: number;
  chan: number;
  firstSeen: number;
  lastSeen: number;
  seenCount: number;
  sensorId?: string;
}

export interface Handshake {
  key: string; // `${ap}_${sta}`
  ap: string;
  sta: string;
  chan: number;
  rssi?: number;
  m1: boolean;
  m2: boolean;
  m3: boolean;
  m4: boolean;
  complete: boolean;
  anonce?: string;
  snonce?: string;
  mic?: string;
  ssid?: string;
  firstSeen: number;
  lastSeen: number;
  sensorId?: string;
}

export interface Pmkid {
  ap: string;
  chan: number;
  pmkid: string;
  ssid?: string;
  t: number;
  sensorId?: string;
}

export interface DeauthEvent {
  ap: string;
  sta: string;
  reason: number;
  chan: number;
  t: number;
  sensorId?: string;
}

export interface LogLine {
  t: number;
  msg: string;
  level: Severity;
}

export interface Alert {
  id: string; // stable per (category + entity)
  severity: Severity;
  category: string;
  title: string;
  detail: string;
  entity: string;
  firstSeen: number;
  lastSeen: number;
  count: number;
  evidence: string[];
  acknowledged: boolean;
}

export interface DeviceStatus {
  mode: number;
  uptime: number;
  heap: number;
  psram: number;
  handshakes: number;
  complete: number;
  stations: number;
  probes: number;
  beacons: number;
  fwVersion: string;
  t: number;
}

export interface Sensors {
  ir: string | null;
  rfid: string | null;
  ibutton: string | null;
  subghz: string | null;
}

export interface PhasorState {
  wifi: Record<string, WifiNetwork>; // keyed by BSSID
  ble: Record<string, BleDevice>; // keyed by address
  probes: Record<string, ProbeDevice>; // keyed by MAC
  stations: Record<string, Station>; // keyed by `${ap}_${sta}`
  handshakes: Record<string, Handshake>; // keyed by `${ap}_${sta}`
  pmkids: Pmkid[];
  deauths: DeauthEvent[]; // rolling window, newest first
  logs: LogLine[];
  alerts: Record<string, Alert>;
  sensors: Sensors;
  status: DeviceStatus | null;
  eventCount: number;
  lastEventAt: number | null;
}

export const SYSTEM_MODES = [
  'Idle',
  'Monitor',
  'Continuous',
  'Beacon Flood',
  'BLE Flood',
] as const;

export function initialState(): PhasorState {
  return {
    wifi: {},
    ble: {},
    probes: {},
    stations: {},
    handshakes: {},
    pmkids: [],
    deauths: [],
    logs: [],
    alerts: {},
    sensors: { ir: null, rfid: null, ibutton: null, subghz: null },
    status: null,
    eventCount: 0,
    lastEventAt: null,
  };
}

export type ConnStatus = 'offline' | 'connecting' | 'connected';
export type LinkMode = 'live' | 'demo';

/** A fleet sensor (one Phasor-S3 appliance). Persisted to localStorage. */
export interface Sensor {
  id: string;
  name: string;
  ip: string;
}

export type ViewId =
  | 'overview'
  | 'wifi'
  | 'bluetooth'
  | 'clients'
  | 'captures'
  | 'attacks'
  | 'log';
