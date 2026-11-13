// ============================================================================
// Device tagging store. A tiny localStorage-backed map of MAC -> DeviceTag used
// to highlight/annotate clients, stations and probes across the dashboard.
// Follows persist.ts robustness: every localStorage access wrapped in try/catch
// (quota / private-mode safe). A module-level listener Set (like Toast.tsx) lets
// React components re-render when tags change via the useTags()/useTag() hooks.
// ============================================================================
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'phasor_device_tags';

export type TagKind = 'target' | 'trusted' | 'watch' | 'rogue';

export interface DeviceTag {
  color: string;
  kind?: TagKind;
  note?: string;
}

/** Named tag presets with their theme-consistent colors. */
export const TAG_PRESETS: Record<TagKind, { label: string; color: string }> = {
  target: { label: 'Target', color: '#d03b3b' },
  rogue: { label: 'Rogue', color: '#ec835a' },
  watch: { label: 'Watch', color: '#fab219' },
  trusted: { label: 'Trusted', color: '#0ca30c' },
};

export const TAG_KINDS: TagKind[] = ['target', 'rogue', 'watch', 'trusted'];

// --- normalization -----------------------------------------------------------
function norm(mac: string): string {
  return (mac || '').toUpperCase();
}

// --- in-memory cache + persistence ------------------------------------------
let cache: Record<string, DeviceTag> | null = null;

function load(): Record<string, DeviceTag> {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as Record<string, DeviceTag>) : {};
  } catch {
    cache = {};
  }
  return cache!;
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache ?? {}));
  } catch {
    /* quota / private mode — ignore */
  }
}

// --- change notification -----------------------------------------------------
type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;

function emit(): void {
  version++;
  listeners.forEach((l) => l());
}

export function subscribe(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// --- public API --------------------------------------------------------------
export function getTag(mac: string): DeviceTag | null {
  return load()[norm(mac)] ?? null;
}

export function setTag(mac: string, tag: DeviceTag | null): void {
  const key = norm(mac);
  if (!key) return;
  const store = load();
  if (tag === null) {
    if (!(key in store)) return;
    delete store[key];
  } else {
    store[key] = tag;
  }
  persist();
  emit();
}

/** Convenience: set a tag from a named preset (or clear with null). */
export function setTagKind(mac: string, kind: TagKind | null, note?: string): void {
  if (kind === null) {
    setTag(mac, null);
    return;
  }
  setTag(mac, { color: TAG_PRESETS[kind].color, kind, note });
}

export function allTags(): Record<string, DeviceTag> {
  return { ...load() };
}

// --- hooks -------------------------------------------------------------------
/** Re-renders the caller whenever ANY tag changes. Returns the full map. */
export function useTags(): Record<string, DeviceTag> {
  const [, force] = useState(0);
  useEffect(() => subscribe(() => force((v) => v + 1)), []);
  return load();
}

/** Re-renders the caller when the tag for a single MAC changes. */
export function useTag(mac: string): DeviceTag | null {
  const [, force] = useState(0);
  useEffect(() => subscribe(() => force((v) => v + 1)), []);
  return getTag(mac);
}

export function tagVersion(): number {
  return version;
}
