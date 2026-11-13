// ============================================================================
// Wire decode: turn a raw WebSocket frame into zero or more DecodedEvents.
// Primary format (current firmware): { "type": <EventType number>, "payload": {...} }.
// Also tolerates: an array of such frames, and the legacy string-typed shape
// ({ "type": "wifi_scan", "wifi": [...] }) so older firmware still renders.
// ============================================================================
import { EventType } from '../types';
import type { DecodedEvent } from './store';

const STRING_TYPE_MAP: Record<string, EventType> = {
  wifi_scan: EventType.WIFI_SCAN,
  ble_scan: EventType.BLE_SCAN,
  probe: EventType.PROBE,
  deauth: EventType.DEAUTH_RX,
  deauth_rx: EventType.DEAUTH_RX,
  handshake: EventType.HANDSHAKE,
  eapol: EventType.HANDSHAKE,
  pmkid: EventType.PM_KID,
  station: EventType.STATION,
  netmap: EventType.STATION,
  log: EventType.LOG,
  status: EventType.STATUS,
};

function normalizeOne(obj: any, now: number): DecodedEvent | null {
  if (!obj || typeof obj !== 'object') return null;

  let type: EventType | undefined;
  if (typeof obj.type === 'number') type = obj.type as EventType;
  else if (typeof obj.type === 'string') type = STRING_TYPE_MAP[obj.type.toLowerCase()];

  if (type === undefined) return null;

  // payload may be nested under `payload`, or the frame itself may carry the
  // fields (legacy). Fall back to the whole object minus `type`.
  let payload = obj.payload;
  if (payload === undefined) {
    const { type: _t, ...rest } = obj;
    void _t;
    payload = rest;
  }
  const t = typeof obj.t === 'number' ? obj.t : now;
  return { type, payload, t };
}

export function decode(raw: string, now = Date.now()): DecodedEvent[] {
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (Array.isArray(data)) {
    return data.map((d) => normalizeOne(d, now)).filter((e): e is DecodedEvent => e !== null);
  }
  const one = normalizeOne(data, now);
  return one ? [one] : [];
}
