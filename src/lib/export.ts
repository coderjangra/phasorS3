// Download / export helpers. Capture formats mirror what the firmware's `E`
// command emits so browser-side export matches device-side export.
import { PhasorState, Handshake, WifiNetwork, BleDevice, Alert } from '../types';

export function downloadText(filename: string, text: string, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Device-format hashcat line: WPA*01*<ap>*<sta>*<anonce>*<snonce>*<mic>* */
export function handshakeToHashline(hs: Handshake): string | null {
  if (!hs.complete || !hs.anonce || !hs.snonce || !hs.mic) return null;
  return `WPA*01*${hs.ap}*${hs.sta}*${hs.anonce}*${hs.snonce}*${hs.mic}*`;
}

export function handshakesExport(handshakes: Handshake[]): string {
  const lines = handshakes.map(handshakeToHashline).filter((l): l is string => l !== null);
  return lines.join('\n') + (lines.length ? '\n' : '');
}

function csv(rows: (string | number)[][]): string {
  return rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export function networksCsv(nets: WifiNetwork[]): string {
  return csv([
    ['ssid', 'bssid', 'rssi', 'channel', 'auth', 'rogue_score', 'flags', 'first_seen', 'last_seen'],
    ...nets.map((n) => [
      n.ssid,
      n.bssid,
      n.rssi,
      n.chan,
      n.auth,
      n.rogueScore,
      n.flags.join('|'),
      new Date(n.firstSeen).toISOString(),
      new Date(n.lastSeen).toISOString(),
    ]),
  ]);
}

export function bleCsv(devs: BleDevice[]): string {
  return csv([
    ['name', 'address', 'rssi', 'seen', 'first_seen', 'last_seen'],
    ...devs.map((d) => [
      d.name || 'Unknown',
      d.addr,
      d.rssi,
      d.seenCount,
      new Date(d.firstSeen).toISOString(),
      new Date(d.lastSeen).toISOString(),
    ]),
  ]);
}

export function alertsCsv(alerts: Alert[]): string {
  return csv([
    ['severity', 'category', 'title', 'entity', 'detail', 'count', 'first_seen', 'last_seen'],
    ...alerts.map((a) => [
      a.severity,
      a.category,
      a.title,
      a.entity,
      a.detail,
      a.count,
      new Date(a.firstSeen).toISOString(),
      new Date(a.lastSeen).toISOString(),
    ]),
  ]);
}

/** Full-session JSON snapshot for offline analysis / replay. */
export function sessionJson(state: PhasorState): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      status: state.status,
      wifi: Object.values(state.wifi),
      ble: Object.values(state.ble),
      probes: Object.values(state.probes),
      stations: Object.values(state.stations),
      handshakes: Object.values(state.handshakes),
      pmkids: state.pmkids,
      deauths: state.deauths,
      alerts: Object.values(state.alerts),
      logs: state.logs,
    },
    null,
    2,
  );
}

export function ts(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
