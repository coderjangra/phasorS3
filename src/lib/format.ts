// Small formatting / stats helpers shared across the UI.
import type { Severity } from '../types';

export function fmtMac(mac?: string): string {
  if (!mac) return '--';
  return mac.toUpperCase();
}

/** First 3 octets of a MAC (the OUI), used for vendor-ish grouping. */
export function oui(mac?: string): string {
  if (!mac) return '';
  return mac.toUpperCase().split(':').slice(0, 3).join(':');
}

/** Locally-administered bit set in the first octet => randomized / spoofed MAC. */
export function isLocallyAdministered(mac?: string): boolean {
  if (!mac) return false;
  const first = parseInt(mac.split(':')[0], 16);
  return Number.isFinite(first) && (first & 0x02) !== 0;
}

export function fmtRssi(rssi?: number): string {
  if (rssi === undefined || rssi === null) return '--';
  return `${rssi} dBm`;
}

/** Map RSSI (dBm) to a 0..4 signal-bar bucket. */
export function rssiBars(rssi?: number): number {
  if (rssi === undefined || rssi === null) return 0;
  if (rssi >= -55) return 4;
  if (rssi >= -67) return 3;
  if (rssi >= -78) return 2;
  if (rssi >= -88) return 1;
  return 0;
}

export function fmtAge(ms: number): string {
  if (ms < 1000) return 'now';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}

export function fmtUptime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function clockTime(t: number): string {
  const d = new Date(t);
  return d.toLocaleTimeString([], { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

export function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1);
  return Math.sqrt(v);
}

// Severity ordering + color roles (validated dataviz status palette).
export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  serious: 1,
  warning: 2,
  info: 3,
  good: 4,
};

export const SEVERITY_COLOR: Record<Severity, string> = {
  critical: '#d03b3b',
  serious: '#ec835a',
  warning: '#fab219',
  good: '#0ca30c',
  info: '#8aa0c0',
};

/** Human label for a Wi-Fi channel's band. */
export function channelBand(ch: number): string {
  if (ch >= 1 && ch <= 14) return '2.4 GHz';
  return '5 GHz';
}
