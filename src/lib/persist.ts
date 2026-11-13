// ============================================================================
// Per-sensor PhasorState persistence. Reload restores networks, BLE, clients,
// captures, alerts and log. Writes are capped so the snapshot stays small and
// fast, and every read/write is wrapped in try/catch (quota / private-mode safe).
// ============================================================================
import { PhasorState, initialState, WifiNetwork, BleDevice } from '../types';

const PREFIX = 'phasor_state_';

// Caps applied when writing a snapshot.
const RSSI_KEEP = 40;
const LOGS_KEEP = 500;
const DEAUTHS_KEEP = 150;
const PMKIDS_KEEP = 100;

function key(sensorId: string): string {
  return `${PREFIX}${sensorId}`;
}

function trimHistory<T extends WifiNetwork | BleDevice>(rec: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(rec)) {
    out[k] = { ...v, rssiHistory: v.rssiHistory.slice(-RSSI_KEEP) } as T;
  }
  return out;
}

/** Build the trimmed, serializable snapshot of a state for one sensor. */
export function snapshot(state: PhasorState): PhasorState {
  return {
    ...state,
    wifi: trimHistory(state.wifi),
    ble: trimHistory(state.ble),
    probes: state.probes,
    stations: state.stations,
    handshakes: state.handshakes,
    pmkids: state.pmkids.slice(0, PMKIDS_KEEP),
    deauths: state.deauths.slice(0, DEAUTHS_KEEP),
    logs: state.logs.slice(-LOGS_KEEP),
    alerts: state.alerts,
  };
}

export function saveState(sensorId: string, state: PhasorState): void {
  try {
    localStorage.setItem(key(sensorId), JSON.stringify(snapshot(state)));
  } catch {
    /* quota / private mode — ignore */
  }
}

/** Merge a persisted snapshot over a fresh initialState so every key is present. */
export function loadState(sensorId: string): PhasorState | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key(sensorId));
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PhasorState>;
    const base = initialState();
    return {
      ...base,
      ...parsed,
      wifi: parsed.wifi ?? base.wifi,
      ble: parsed.ble ?? base.ble,
      probes: parsed.probes ?? base.probes,
      stations: parsed.stations ?? base.stations,
      handshakes: parsed.handshakes ?? base.handshakes,
      pmkids: parsed.pmkids ?? base.pmkids,
      deauths: parsed.deauths ?? base.deauths,
      logs: parsed.logs ?? base.logs,
      alerts: parsed.alerts ?? base.alerts,
      sensors: parsed.sensors ?? base.sensors,
      status: parsed.status ?? base.status,
      eventCount: parsed.eventCount ?? base.eventCount,
      lastEventAt: parsed.lastEventAt ?? base.lastEventAt,
    };
  } catch {
    return null;
  }
}

export function clearState(sensorId: string): void {
  try {
    localStorage.removeItem(key(sensorId));
  } catch {
    /* ignore */
  }
}
