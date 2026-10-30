/** Best-effort localStorage JSON helpers: storage can be unavailable (private mode) or full. */
export function readStored<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Optional persistence; ignore failures.
  }
}

/** A small TTL cache keyed by string, persisted in one localStorage entry. */
export function createTtlCache<T>(storageKey: string, ttlMs: number, maxEntries = 50) {
  type Entry = { value: T; at: number };
  return {
    get(key: string): T | null {
      const entry = readStored<Record<string, Entry>>(storageKey)?.[key];
      return entry && Date.now() - entry.at <= ttlMs ? entry.value : null;
    },
    set(key: string, value: T) {
      const all = readStored<Record<string, Entry>>(storageKey) ?? {};
      all[key] = { value, at: Date.now() };
      const kept = Object.entries(all)
        .filter(([, e]) => Date.now() - e.at <= ttlMs)
        .sort((a, b) => b[1].at - a[1].at)
        .slice(0, maxEntries);
      writeStored(storageKey, Object.fromEntries(kept));
    },
  };
}
