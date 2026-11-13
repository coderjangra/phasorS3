// ============================================================================
// Fleet sensor list persistence. A Sensor is one Phasor-S3 appliance
// ({ id, name, ip }). The list + active id live in localStorage, seeded from
// the legacy `phasor_ip` default so existing installs keep working.
// All storage access is wrapped in try/catch (quota / private-mode safe).
// ============================================================================
import type { Sensor } from '../types';

const SENSORS_KEY = 'phasor_sensors';
const ACTIVE_KEY = 'phasor_active_sensor';
const LEGACY_IP_KEY = 'phasor_ip';

export const DEFAULT_IP = '192.168.4.1';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota / private mode — ignore */
  }
}

export function newSensorId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function seedIp(): string {
  const legacy = safeGet(LEGACY_IP_KEY);
  if (legacy) return legacy;
  if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost') {
    return window.location.hostname;
  }
  return DEFAULT_IP;
}

/** Load the sensor list, creating a default one from the legacy IP if empty. */
export function loadSensors(): Sensor[] {
  const raw = safeGet(SENSORS_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        const list = parsed
          .filter((s) => s && typeof s.id === 'string' && typeof s.ip === 'string')
          .map((s) => ({ id: String(s.id), name: String(s.name || s.ip), ip: String(s.ip) }));
        if (list.length) return list;
      }
    } catch {
      /* fall through to seed */
    }
  }
  const seeded: Sensor[] = [{ id: 'default', name: 'Phasor-S3', ip: seedIp() }];
  saveSensors(seeded);
  return seeded;
}

export function saveSensors(sensors: Sensor[]): void {
  safeSet(SENSORS_KEY, JSON.stringify(sensors));
}

export function loadActiveSensorId(sensors: Sensor[]): string {
  const saved = safeGet(ACTIVE_KEY);
  if (saved && sensors.some((s) => s.id === saved)) return saved;
  return sensors[0]?.id ?? 'default';
}

export function saveActiveSensorId(id: string): void {
  safeSet(ACTIVE_KEY, id);
}

/** Keep the legacy key in sync so anything still reading it sees the active IP. */
export function syncLegacyIp(ip: string): void {
  safeSet(LEGACY_IP_KEY, ip);
}
