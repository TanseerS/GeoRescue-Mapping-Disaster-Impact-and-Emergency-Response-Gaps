import { SEVERITIES, SIGNIFICANT_MAGNITUDE } from "../config/constants";
import type { Earthquake, EarthquakeFilters, SeverityLevel, TimeRange } from "../types/earthquake";

export interface EarthquakeStats {
  total: number;
  significant: number;
  averageMagnitude: number | null;
  maxMagnitude: number | null;
  strongest: Earthquake | null;
  tsunamiFlags: number;
}

export function filterEarthquakes(earthquakes: Earthquake[], filters: EarthquakeFilters): Earthquake[] {
  const allowed = new Set<SeverityLevel>(filters.severities);
  return earthquakes.filter((q) => q.magnitude >= filters.minMagnitude && allowed.has(q.severity));
}

export function computeStats(earthquakes: Earthquake[]): EarthquakeStats {
  if (earthquakes.length === 0) {
    return { total: 0, significant: 0, averageMagnitude: null, maxMagnitude: null, strongest: null, tsunamiFlags: 0 };
  }
  let sum = 0;
  let significant = 0;
  let tsunamiFlags = 0;
  let strongest = earthquakes[0];
  for (const q of earthquakes) {
    sum += q.magnitude;
    if (q.magnitude >= SIGNIFICANT_MAGNITUDE) significant += 1;
    if (q.tsunami) tsunamiFlags += 1;
    if (q.magnitude > strongest.magnitude) strongest = q;
  }
  return {
    total: earthquakes.length,
    significant,
    averageMagnitude: sum / earthquakes.length,
    maxMagnitude: strongest.magnitude,
    strongest,
    tsunamiFlags,
  };
}

export interface MagnitudeBin {
  label: string;
  count: number;
  severity: SeverityLevel;
}

/** One-unit magnitude bins from the lowest to highest loaded magnitude. */
export function magnitudeHistogram(earthquakes: Earthquake[]): MagnitudeBin[] {
  if (earthquakes.length === 0) return [];
  const floors = earthquakes.map((q) => Math.max(-1, Math.floor(q.magnitude)));
  const min = Math.min(...floors);
  const max = Math.max(...floors);
  const bins: MagnitudeBin[] = [];
  for (let m = min; m <= max; m += 1) {
    const mid = m + 0.5;
    const severity = [...SEVERITIES].reverse().find((s) => mid >= s.min)?.id ?? "minor";
    bins.push({ label: `${m}`, count: 0, severity });
  }
  floors.forEach((f) => {
    bins[f - min].count += 1;
  });
  return bins;
}

export interface TimelineBucket {
  start: number;
  label: string;
  count: number;
}

/** Hourly buckets for 24 h, 6-hour buckets for 7 days, daily buckets for 30 days. */
export function eventTimeline(earthquakes: Earthquake[], range: TimeRange, now: number = Date.now()): TimelineBucket[] {
  const hour = 3_600_000;
  const config = {
    day: { bucket: hour, count: 24 },
    week: { bucket: 6 * hour, count: 28 },
    month: { bucket: 24 * hour, count: 30 },
  }[range];
  const end = Math.ceil(now / config.bucket) * config.bucket;
  const start = end - config.bucket * config.count;
  const buckets: TimelineBucket[] = Array.from({ length: config.count }, (_, i) => {
    const t = start + i * config.bucket;
    const d = new Date(t);
    const label =
      range === "day"
        ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
        : range === "week"
          ? d.toLocaleString(undefined, { weekday: "short", hour: "2-digit" })
          : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return { start: t, label, count: 0 };
  });
  for (const q of earthquakes) {
    const idx = Math.floor((q.time - start) / config.bucket);
    if (idx >= 0 && idx < buckets.length) buckets[idx].count += 1;
  }
  return buckets;
}

/** Abbreviations USGS uses in place strings for frequently reporting regions. */
const REGION_NAMES: Record<string, string> = {
  CA: "California",
  NV: "Nevada",
  OR: "Oregon",
  WA: "Washington",
  UT: "Utah",
  ID: "Idaho",
  MT: "Montana",
  WY: "Wyoming",
  NM: "New Mexico",
  AZ: "Arizona",
  OK: "Oklahoma",
  KS: "Kansas",
  CO: "Colorado",
  TN: "Tennessee",
  MO: "Missouri",
  AR: "Arkansas",
  MX: "Mexico",
  PR: "Puerto Rico",
};

/** Groups events by the region part of the USGS place string ("10 km SSW of X, Region"). */
export function topRegions(earthquakes: Earthquake[], limit = 5): { region: string; count: number; maxMag: number }[] {
  const map = new Map<string, { count: number; maxMag: number }>();
  for (const q of earthquakes) {
    const parts = q.place.split(",");
    const raw = (parts.length > 1 ? parts[parts.length - 1] : q.place.replace(/^.*\bof\s+/i, "")).trim() || "Unknown";
    const region = REGION_NAMES[raw] ?? raw;
    const entry = map.get(region) ?? { count: 0, maxMag: -Infinity };
    entry.count += 1;
    entry.maxMag = Math.max(entry.maxMag, q.magnitude);
    map.set(region, entry);
  }
  return [...map.entries()]
    .map(([region, v]) => ({ region, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
