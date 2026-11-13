// ============================================================================
// Threat analytics engine — the academic core of Phasor-S3.
//
// Implements, in-browser over live telemetry, the detection logic the project
// report is grounded in:
//   * Liu & Papadimitratos (2024) — multi-subset RSSI spatial consistency:
//       a legitimate fixed AP has stable RSSI; large variance / a cloned SSID
//       appearing from a second BSSID signals a rogue/evil-twin AP.
//   * McGinniss (2023) — physical-layer / channel characteristics:
//       a single BSSID observed across multiple channels, or an auth downgrade,
//       bypasses header-level spoofing defenses.
//   * Halder et al. "SmartLens" (2023) — temporal / statistical feature
//       profiling: probe-request frequency and deauth bursts flag devices that
//       deviate from baseline operational behavior.
// ============================================================================
import { PhasorState, WifiNetwork, Alert, Severity } from '../types';
import { stddev, oui, isLocallyAdministered } from './format';

const RSSI_STD_WARN = 8; // dB — spatial-consistency threshold
const RSSI_RANGE_WARN = 22; // dB peak-to-peak
const RSSI_MIN_SAMPLES = 6;
const PROBE_SSID_FLOOD = 8; // distinct SSIDs probed by one client
const DEAUTH_WINDOW_MS = 30_000;
const DEAUTH_FLOOD = 10;

const SECURE = ['WPA2', 'WPA3', 'WPA2/WPA3', 'WPA2-ENT', 'WPA/WPA2'];
const WEAK = ['OPEN', 'WEP'];

const FLAG_WEIGHT: Record<string, number> = {
  'evil-twin': 45,
  'auth-downgrade': 55,
  'multi-channel': 25,
  'rssi-unstable': 20,
  'randomized-bssid': 15,
  karma: 35,
};

export interface AnalyticsResult {
  alerts: Record<string, Alert>;
  wifi: Record<string, WifiNetwork>; // same map, with rogueScore + flags filled
}

function mkAlert(
  prev: Record<string, Alert>,
  now: number,
  category: string,
  entity: string,
  severity: Severity,
  title: string,
  detail: string,
  evidence: string[],
  count = 1,
): Alert {
  const id = `${category}:${entity}`;
  const existing = prev[id];
  return {
    id,
    category,
    entity,
    severity,
    title,
    detail,
    evidence,
    count,
    firstSeen: existing?.firstSeen ?? now,
    lastSeen: now,
    acknowledged: existing?.acknowledged ?? false,
  };
}

export function analyze(state: PhasorState, now = Date.now()): AnalyticsResult {
  const alerts: Record<string, Alert> = {};
  const prev = state.alerts;

  // Fresh copies so we can attach scores without mutating store state.
  const wifi: Record<string, WifiNetwork> = {};
  for (const [k, v] of Object.entries(state.wifi)) {
    wifi[k] = { ...v, flags: [], rogueScore: 0 };
  }
  const nets = Object.values(wifi);
  const addFlag = (n: WifiNetwork, f: string) => {
    if (!n.flags.includes(f)) n.flags.push(f);
  };

  // --- Group by SSID for evil-twin / downgrade detection ---
  const bySsid = new Map<string, WifiNetwork[]>();
  for (const n of nets) {
    if (!n.ssid || n.ssid === '<Hidden>') continue;
    const arr = bySsid.get(n.ssid) ?? [];
    arr.push(n);
    bySsid.set(n.ssid, arr);
  }

  for (const [ssid, group] of bySsid) {
    if (group.length < 2) continue;
    const bssids = group.map((g) => g.bssid);
    const distinctOui = new Set(group.map((g) => oui(g.bssid)));
    const auths = new Set(group.flatMap((g) => g.auths));
    const hasSecure = [...auths].some((a) => SECURE.includes(a));
    const hasWeak = [...auths].some((a) => WEAK.includes(a));

    const downgrade = hasSecure && hasWeak;
    const severity: Severity = downgrade ? 'critical' : 'serious';
    const category = downgrade ? 'auth-downgrade' : 'evil-twin';
    const flag = downgrade ? 'auth-downgrade' : 'evil-twin';
    group.forEach((g) => addFlag(g, flag));

    const a = mkAlert(
      prev,
      now,
      category,
      ssid,
      severity,
      downgrade ? `Auth downgrade on "${ssid}"` : `Possible evil twin: "${ssid}"`,
      downgrade
        ? `SSID "${ssid}" is advertised with both secure and open/WEP security across ${bssids.length} BSSIDs — classic evil-twin downgrade.`
        : `SSID "${ssid}" is advertised by ${bssids.length} different BSSIDs${distinctOui.size > 1 ? ` across ${distinctOui.size} vendors` : ''}, consistent with a cloned access point.`,
      [
        `BSSIDs: ${bssids.join(', ')}`,
        `Auth modes: ${[...auths].join(', ')}`,
        `Channels: ${[...new Set(group.flatMap((g) => g.channels))].join(', ')}`,
      ],
      bssids.length,
    );
    alerts[a.id] = a;
  }

  // --- Per-AP physical-layer + spatial checks ---
  for (const n of nets) {
    // Multi-channel BSSID (McGinniss): a single radio shouldn't beacon on many channels.
    if (n.channels.length > 1) {
      addFlag(n, 'multi-channel');
      const a = mkAlert(
        prev,
        now,
        'multi-channel',
        n.bssid,
        'serious',
        `BSSID on multiple channels`,
        `${n.bssid}${n.ssid ? ` ("${n.ssid}")` : ''} observed on channels ${n.channels.join(', ')} — a stationary AP normally occupies one channel.`,
        [`Channels: ${n.channels.join(', ')}`, `SSID: ${n.ssid || '<hidden>'}`],
        n.channels.length,
      );
      alerts[a.id] = a;
    }

    // Randomized / locally-administered BSSID — real APs rarely use one.
    if (isLocallyAdministered(n.bssid)) {
      addFlag(n, 'randomized-bssid');
      const a = mkAlert(
        prev,
        now,
        'randomized-bssid',
        n.bssid,
        'warning',
        `Randomized AP MAC`,
        `${n.bssid} uses a locally-administered (randomized) address — common in beacon-flood / spoofed frames, rare in real hardware.`,
        [`SSID: ${n.ssid || '<hidden>'}`, `Auth: ${n.auth}`],
      );
      alerts[a.id] = a;
    }

    // RSSI spatial consistency (Liu & Papadimitratos).
    if (n.rssiHistory.length >= RSSI_MIN_SAMPLES) {
      const vals = n.rssiHistory.map((h) => h.rssi);
      const sd = stddev(vals);
      const range = Math.max(...vals) - Math.min(...vals);
      if (sd > RSSI_STD_WARN && range > RSSI_RANGE_WARN) {
        addFlag(n, 'rssi-unstable');
        const a = mkAlert(
          prev,
          now,
          'rssi-unstable',
          n.bssid,
          'warning',
          `Unstable signal footprint`,
          `${n.bssid}${n.ssid ? ` ("${n.ssid}")` : ''} shows σ=${sd.toFixed(1)} dB over ${range} dB range — inconsistent with a single fixed transmitter (spatial-consistency anomaly).`,
          [`RSSI σ: ${sd.toFixed(1)} dB`, `Range: ${range} dB`, `Samples: ${vals.length}`],
        );
        alerts[a.id] = a;
      }
    }

    n.rogueScore = Math.min(100, n.flags.reduce((acc, f) => acc + (FLAG_WEIGHT[f] ?? 0), 0));
  }

  // --- Karma detection (Halder temporal): a probed SSID that materializes as an AP ---
  const probedSsids = new Set<string>();
  for (const p of Object.values(state.probes)) {
    for (const s of p.ssids) if (s) probedSsids.add(s);
  }
  for (const n of nets) {
    if (n.ssid && probedSsids.has(n.ssid) && isLocallyAdministered(n.bssid)) {
      addFlag(n, 'karma');
      n.rogueScore = Math.min(100, n.rogueScore + FLAG_WEIGHT.karma);
      const a = mkAlert(
        prev,
        now,
        'karma',
        n.bssid,
        'serious',
        `Possible karma / rogue responder`,
        `AP "${n.ssid}" (${n.bssid}) matches an SSID that clients were actively probing for and uses a randomized MAC — consistent with a karma-style rogue AP answering probe requests.`,
        [`SSID: ${n.ssid}`, `BSSID: ${n.bssid}`],
      );
      alerts[a.id] = a;
    }
  }

  // --- Probe flood (Halder temporal profiling) ---
  for (const p of Object.values(state.probes)) {
    if (p.ssids.length >= PROBE_SSID_FLOOD) {
      const a = mkAlert(
        prev,
        now,
        'probe-flood',
        p.mac,
        'warning',
        `High-fanout probing client`,
        `${p.mac} has probed for ${p.ssids.length} distinct SSIDs — consistent with a device enumerating saved networks or an attacker's karma client.`,
        [`SSIDs: ${p.ssids.slice(0, 12).join(', ')}${p.ssids.length > 12 ? '…' : ''}`],
        p.ssids.length,
      );
      alerts[a.id] = a;
    }
  }

  // --- Deauth flood (active attack in the airspace) ---
  const recent = state.deauths.filter((d) => now - d.t < DEAUTH_WINDOW_MS);
  if (recent.length >= DEAUTH_FLOOD) {
    const byAp = new Map<string, number>();
    for (const d of recent) byAp.set(d.ap, (byAp.get(d.ap) ?? 0) + 1);
    const top = [...byAp.entries()].sort((a, b) => b[1] - a[1])[0];
    const a = mkAlert(
      prev,
      now,
      'deauth-flood',
      'airspace',
      'critical',
      `Deauthentication flood detected`,
      `${recent.length} deauth frames seen in the last ${DEAUTH_WINDOW_MS / 1000}s — an active deauth / disassociation attack is in progress.`,
      [
        `Frames (30s): ${recent.length}`,
        top ? `Top source AP: ${top[0]} (${top[1]} frames)` : '',
        `Channels: ${[...new Set(recent.map((d) => d.chan))].join(', ')}`,
      ].filter(Boolean),
      recent.length,
    );
    alerts[a.id] = a;
  }

  return { alerts, wifi };
}

/** Sort helper: most severe, then most recent. */
export function alertSort(a: Alert, b: Alert): number {
  const rank: Record<Severity, number> = { critical: 0, serious: 1, warning: 2, info: 3, good: 4 };
  if (rank[a.severity] !== rank[b.severity]) return rank[a.severity] - rank[b.severity];
  return b.lastSeen - a.lastSeen;
}
