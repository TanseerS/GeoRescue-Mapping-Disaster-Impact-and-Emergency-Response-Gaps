import type { Facility } from "../types/facility";

const STORAGE_KEY = "georescue:facilities:v1";
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 40;

interface CacheEntry {
  facilities: Facility[];
  fetchedAt: number;
}

function readAll(): Record<string, CacheEntry> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CacheEntry>) : {};
  } catch {
    return {};
  }
}

/** Returns facilities previously fetched for this query key, if still fresh. */
export function readCachedFacilities(key: string): CacheEntry | null {
  const entry = readAll()[key];
  if (!entry || Date.now() - entry.fetchedAt > TTL_MS) return null;
  return entry;
}

/** Persists real Overpass responses so revisited areas load instantly (best effort). */
export function writeCachedFacilities(key: string, entry: CacheEntry) {
  try {
    const all = readAll();
    all[key] = entry;
    const fresh = Object.entries(all)
      .filter(([, e]) => Date.now() - e.fetchedAt <= TTL_MS)
      .sort((a, b) => b[1].fetchedAt - a[1].fetchedAt)
      .slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(fresh)));
  } catch {
    // Storage may be full or unavailable (private mode); caching is optional.
  }
}
