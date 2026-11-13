// ============================================================================
// Log line classifier. Turns a raw firmware log message into a structured,
// human-readable row: a category chip, a severity, and a plain-English
// explanation. Patterns are generous but always fall back to the raw line.
// ============================================================================
import type { LogLine, Severity } from '../types';

export type LogCategory =
  | 'DEAUTH'
  | 'HANDSHAKE'
  | 'PMKID'
  | 'BEACON'
  | 'PROBE'
  | 'STATION'
  | 'NETMAP'
  | 'AUTH'
  | 'BLE'
  | 'SYSTEM'
  | 'SIM'
  | 'OTHER';

export interface ClassifiedLog {
  category: LogCategory;
  severity: Severity;
  /** Plain-English meaning, or '' when we only have the raw line. */
  humanText: string;
}

export const CATEGORY_COLOR: Record<LogCategory, string> = {
  DEAUTH: '#d03b3b',
  HANDSHAKE: '#0ca30c',
  PMKID: '#3987e5',
  BEACON: '#fab219',
  PROBE: '#8aa0c0',
  STATION: '#b39ddb',
  NETMAP: '#b39ddb',
  AUTH: '#ec835a',
  BLE: '#651fff',
  SYSTEM: '#8aa0c0',
  SIM: '#7e57c2',
  OTHER: '#9a93a8',
};

interface Rule {
  re: RegExp;
  category: LogCategory;
  severity: Severity;
  human: (m: string) => string;
}

// First match wins; order from most-specific to least.
const RULES: Rule[] = [
  {
    re: /\bEAPOL\b.*(complete|m3|message 3|msg3)|handshake.*(complete|captured)/i,
    category: 'HANDSHAKE',
    severity: 'serious',
    human: () => 'A WPA 4-way handshake was captured — this network can now be cracked offline (authorized testing only).',
  },
  {
    re: /\[?EAPOL|\bhandshake\b|\bm1\b|\bm2\b|\bm3\b|\bm4\b|4-?way/i,
    category: 'HANDSHAKE',
    severity: 'good',
    human: () => 'Part of a WPA handshake was seen. All four messages are needed before it is crackable.',
  },
  {
    re: /\[?PMKID/i,
    category: 'PMKID',
    severity: 'serious',
    human: () => 'A PMKID was captured from an AP — a clientless path to cracking its passphrase offline.',
  },
  {
    re: /\[?DEAUTH|deauth|disassoc/i,
    category: 'DEAUTH',
    severity: 'warning',
    human: () => 'A deauthentication frame was seen — a client is being forcibly disconnected. Could be an attack or your own test.',
  },
  {
    re: /\[?BEACON|beacon flood/i,
    category: 'BEACON',
    severity: 'warning',
    human: (m) =>
      /start|online|broadcast/i.test(m)
        ? 'Beacon flood active — the device is broadcasting fake Wi-Fi network names.'
        : /stop|restore/i.test(m)
          ? 'Beacon flood stopped.'
          : /load|clear|add/i.test(m)
            ? 'Beacon SSID list updated.'
            : 'Beacon activity.',
  },
  {
    re: /\[?PROBE|probe request/i,
    category: 'PROBE',
    severity: 'info',
    human: () => 'A client sent a probe request — broadcasting a saved network name while looking for Wi-Fi.',
  },
  {
    re: /\[?NETMAP/i,
    category: 'NETMAP',
    severity: 'info',
    human: () => 'Client-to-AP association mapping updated.',
  },
  {
    re: /\[?STATION|\bassoc(iation)?\b/i,
    category: 'STATION',
    severity: 'info',
    human: () => 'A client station was observed associating with an access point.',
  },
  {
    re: /\[?AUTH\b|authentication/i,
    category: 'AUTH',
    severity: 'info',
    human: () => 'An 802.11 authentication frame was seen.',
  },
  {
    re: /\[?BLE|bluetooth|advertis/i,
    category: 'BLE',
    severity: 'info',
    human: (m) =>
      /flood/i.test(m) ? 'BLE advertisement flood activity.' : 'Bluetooth Low Energy activity.',
  },
  {
    re: /\[?SIM\b|synthetic|demo airspace/i,
    category: 'SIM',
    severity: 'info',
    human: () => 'Demo-mode synthetic event (no real radio activity).',
  },
  {
    re: /error|fail|fault|panic/i,
    category: 'SYSTEM',
    severity: 'serious',
    human: () => 'The device reported an error condition.',
  },
  {
    re: /\[?SYS|\[?CMD|status|mode|uptime|heap|boot|init|scan|sweep|monitor|continuous|clear/i,
    category: 'SYSTEM',
    severity: 'info',
    human: () => 'System / command activity.',
  },
];

export function classifyLog(line: LogLine): ClassifiedLog {
  const msg = line.msg || '';
  for (const r of RULES) {
    if (r.re.test(msg)) {
      // The explicit level on the line, if more severe than the rule, wins.
      const severity = severityMax(line.level, r.severity);
      return { category: r.category, severity, humanText: r.human(msg) };
    }
  }
  return { category: 'OTHER', severity: line.level ?? 'info', humanText: '' };
}

const RANK: Record<Severity, number> = { critical: 0, serious: 1, warning: 2, info: 3, good: 4 };
function severityMax(a: Severity | undefined, b: Severity): Severity {
  if (!a) return b;
  // good is a "positive" severity; never let it override a real warning/error.
  if (a === 'good') return b === 'good' ? 'good' : b;
  return RANK[a] <= RANK[b] ? a : b;
}

export const ALL_CATEGORIES: LogCategory[] = [
  'DEAUTH',
  'HANDSHAKE',
  'PMKID',
  'BEACON',
  'PROBE',
  'STATION',
  'NETMAP',
  'AUTH',
  'BLE',
  'SYSTEM',
  'SIM',
  'OTHER',
];
