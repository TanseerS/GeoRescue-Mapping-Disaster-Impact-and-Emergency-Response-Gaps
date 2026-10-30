import { createLogger } from "../src/shared/logger";

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export const NOW = Date.UTC(2026, 9, 30, 12, 0, 0);

export function feature(id: string, opts: { mag?: number | null; time?: number; updated?: number; lon?: number; lat?: number } = {}) {
  const time = opts.time ?? NOW - HOUR;
  return {
    type: "Feature",
    id,
    properties: {
      mag: opts.mag === undefined ? 2.5 : opts.mag,
      place: `Place ${id}`,
      time,
      updated: opts.updated ?? time,
      tsunami: 0,
      magType: "ml",
      url: `https://earthquake.usgs.gov/earthquakes/eventpage/${id}`,
    },
    geometry: { type: "Point", coordinates: [opts.lon ?? -120.5, opts.lat ?? 36.1, 8.2] },
  };
}

export function feed(features: unknown[], generated = NOW) {
  return { type: "FeatureCollection", metadata: { generated, title: "USGS All Earthquakes, Past Day", count: features.length }, features };
}

export const silentLogger = createLogger({}, () => undefined);

/** Fake fetch serving fixed JSON per URL suffix. */
export function fakeFetch(routes: Record<string, unknown | (() => unknown)>) {
  const calls: string[] = [];
  const fn = async (url: string) => {
    calls.push(url);
    const key = Object.keys(routes).find((k) => url.endsWith(k));
    if (!key) return { ok: false, status: 404, json: async () => ({}) };
    const value = routes[key];
    const body = typeof value === "function" ? (value as () => unknown)() : value;
    if (body instanceof Error) throw body;
    if (typeof body === "number") return { ok: false, status: body, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => body };
  };
  return Object.assign(fn, { calls });
}
