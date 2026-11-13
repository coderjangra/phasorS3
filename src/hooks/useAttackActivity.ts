// ============================================================================
// useAttackActivity — derives "is an attack/RF event running + what's happening"
// purely from PhasorState. Powers the live Attack Activity Monitor panel.
//
// It never mutates state; it only reads slices and folds them into a unified,
// newest-first feed plus a few summary flags. A 1s ticking interval keeps the
// "last 5s" deauth rate and the elapsed timer fresh between discrete events.
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PhasorState, DeauthEvent, Handshake, Pmkid, Severity, LogLine } from '../types';
import { SYSTEM_MODES } from '../types';

export type AttackKind = 'deauth' | 'beaconFlood' | 'bleFlood' | 'handshake' | 'pmkid';

/** Icon hint consumed by the panel to pick a lucide glyph (keeps JSX out of the hook). */
export type ActivityIcon = 'deauth' | 'beacon' | 'ble' | 'pmkid' | 'handshake' | 'log';

export interface ActivityFeedItem {
  id: string;
  t: number;
  kind: AttackKind | 'log';
  icon: ActivityIcon;
  label: string;
  detail?: string;
  severity: Severity;
}

export interface AttackActivity {
  active: boolean;
  kinds: AttackKind[];
  deauthRate: number; // deauth frames observed in the last ~5s
  recentDeauths: DeauthEvent[];
  beaconFlood: boolean; // mode === 3
  bleFlood: boolean; // mode === 4
  handshakeInProgress: Handshake | null;
  recentPmkid: Pmkid | null;
  feed: ActivityFeedItem[];
  startedAt: number | null;
}

// Time windows (ms).
const DEAUTH_WINDOW = 5_000; // "rate" window
const RECENT_WINDOW = 8_000; // handshake / pmkid freshness
const FEED_WINDOW = 20_000; // how far back the feed reaches
const FEED_CAP = 40;

const LOG_RE = /\[?\s*(DEAUTH|BEACON|BLE|EAPOL|PMKID|FORCE-?HS)\b/i;

function logSeverity(line: LogLine): Severity {
  return line.level;
}

/** Icon hint for an attack-relevant log line, from its leading tag. */
function logIcon(msg: string): ActivityIcon {
  const m = msg.match(LOG_RE);
  const tag = (m?.[1] ?? '').toUpperCase().replace('-', '');
  if (tag.startsWith('DEAUTH')) return 'deauth';
  if (tag.startsWith('BEACON')) return 'beacon';
  if (tag.startsWith('BLE')) return 'ble';
  if (tag.startsWith('PMKID')) return 'pmkid';
  if (tag.startsWith('EAPOL') || tag.startsWith('FORCEHS')) return 'handshake';
  return 'log';
}

/** Short "M1 M2 ✓" style progress string for a handshake. */
function handshakeProgress(h: Handshake): string {
  const parts: string[] = [];
  if (h.m1) parts.push('M1');
  if (h.m2) parts.push('M2');
  if (h.m3) parts.push('M3');
  if (h.m4) parts.push('M4');
  const got = parts.length ? parts.join(' ') : 'listening';
  return h.complete ? `${got} ✓ complete` : `${got}…`;
}

export function useAttackActivity(state: PhasorState): AttackActivity {
  // 1s tick so time-window math stays live even when no new events arrive.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const mode = state.status?.mode ?? null;
  const beaconFlood = mode !== null && SYSTEM_MODES[mode] === 'Beacon Flood';
  const bleFlood = mode !== null && SYSTEM_MODES[mode] === 'BLE Flood';

  const deauths = state.deauths; // newest first
  const pmkids = state.pmkids; // newest first
  const handshakes = state.handshakes;
  const logs = state.logs; // oldest first (appended)

  // --- deauth rate (last ~5s) ---
  const deauthRate = useMemo(() => {
    const cutoff = now - DEAUTH_WINDOW;
    let n = 0;
    for (const d of deauths) {
      if (d.t >= cutoff) n++;
      else break; // newest-first: once we pass the window we're done
    }
    return n;
  }, [deauths, now]);

  const recentDeauths = useMemo(() => deauths.slice(0, 12), [deauths]);

  // --- handshake updated recently (in progress or just completed) ---
  const handshakeInProgress = useMemo(() => {
    let best: Handshake | null = null;
    for (const h of Object.values(handshakes)) {
      if (now - h.lastSeen <= RECENT_WINDOW) {
        if (!best || h.lastSeen > best.lastSeen) best = h;
      }
    }
    return best;
  }, [handshakes, now]);

  // --- most recent pmkid, if fresh ---
  const recentPmkid = useMemo(() => {
    const p = pmkids[0] ?? null;
    if (p && now - p.t <= RECENT_WINDOW) return p;
    return null;
  }, [pmkids, now]);

  const kinds: AttackKind[] = [];
  if (deauthRate > 0) kinds.push('deauth');
  if (beaconFlood) kinds.push('beaconFlood');
  if (bleFlood) kinds.push('bleFlood');
  if (handshakeInProgress) kinds.push('handshake');
  if (recentPmkid) kinds.push('pmkid');

  const active = kinds.length > 0;

  // --- startedAt: when the current contiguous activity window began ---
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const wasActive = useRef(false);
  useEffect(() => {
    if (active && !wasActive.current) setStartedAt(Date.now());
    else if (!active && wasActive.current) setStartedAt(null);
    wasActive.current = active;
  }, [active]);

  // --- unified feed (newest first, capped) ---
  const feed = useMemo(() => {
    const cutoff = now - FEED_WINDOW;
    const items: ActivityFeedItem[] = [];

    // Deauth frames.
    for (const d of deauths) {
      if (d.t < cutoff) break; // newest first
      items.push({
        id: `dx-${d.ap}-${d.sta}-${d.t}`,
        t: d.t,
        kind: 'deauth',
        icon: 'deauth',
        label: `${d.ap || '??'} → ${d.sta || 'broadcast'}`,
        detail: `reason ${d.reason} · ch${d.chan}`,
        severity: 'serious',
      });
    }

    // Attack-relevant log lines.
    for (let i = logs.length - 1; i >= 0; i--) {
      const l = logs[i];
      if (l.t < cutoff) break; // oldest first, so earlier entries are older
      if (!LOG_RE.test(l.msg)) continue;
      items.push({
        id: `lg-${l.t}-${i}`,
        t: l.t,
        kind: 'log',
        icon: logIcon(l.msg),
        label: l.msg,
        severity: logSeverity(l),
      });
    }

    // Handshake milestones (recently updated captures).
    for (const h of Object.values(handshakes)) {
      if (h.lastSeen < cutoff) continue;
      items.push({
        id: `hs-${h.key}-${h.lastSeen}`,
        t: h.lastSeen,
        kind: 'handshake',
        icon: 'handshake',
        label: `Handshake ${h.ssid || h.ap}`,
        detail: handshakeProgress(h),
        severity: h.complete ? 'critical' : 'warning',
      });
    }

    // PMKID captures.
    for (const p of pmkids) {
      if (p.t < cutoff) break; // newest first
      items.push({
        id: `pm-${p.ap}-${p.t}`,
        t: p.t,
        kind: 'pmkid',
        icon: 'pmkid',
        label: `PMKID ${p.ssid || p.ap}`,
        detail: `ch${p.chan}`,
        severity: 'critical',
      });
    }

    items.sort((a, b) => b.t - a.t);
    return items.slice(0, FEED_CAP);
  }, [deauths, logs, handshakes, pmkids, now]);

  return {
    active,
    kinds,
    deauthRate,
    recentDeauths,
    beaconFlood,
    bleFlood,
    handshakeInProgress,
    recentPmkid,
    feed,
    startedAt,
  };
}
