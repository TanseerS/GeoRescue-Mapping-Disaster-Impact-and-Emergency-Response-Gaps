import { DEPTH_CLASSES, FACILITY_KINDS, SEVERITIES, SIGNIFICANT_MAGNITUDE } from "../config/constants";
import type { Facility, FacilityKind } from "../types/facility";
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

/** Region part of a USGS place string ("10 km SSW of X, Region"), with US state abbreviations expanded. */
export function regionOf(place: string): string {
  const parts = place.split(",");
  const raw = (parts.length > 1 ? parts[parts.length - 1] : place.replace(/^.*\bof\s+/i, "")).trim() || "Unknown";
  return REGION_NAMES[raw] ?? raw;
}

/** Groups events by the region part of the USGS place string ("10 km SSW of X, Region"). */
export function topRegions(earthquakes: Earthquake[], limit = 5): { region: string; count: number; maxMag: number }[] {
  const map = new Map<string, { count: number; maxMag: number }>();
  for (const q of earthquakes) {
    const region = regionOf(q.place);
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

export type DepthClass = (typeof DEPTH_CLASSES)[number];

export function depthClass(depthKm: number): DepthClass {
  return DEPTH_CLASSES.find((c) => depthKm < c.max) ?? DEPTH_CLASSES[DEPTH_CLASSES.length - 1];
}

/** Focal depth bins (km), each tagged with its seismological depth class. */
const DEPTH_BINS = [0, 10, 30, 70, 150, 300, 700];

export interface DepthBin {
  label: string;
  count: number;
  depthClass: DepthClass["id"];
}

export function depthHistogram(earthquakes: Earthquake[]): DepthBin[] {
  const bins: DepthBin[] = DEPTH_BINS.slice(0, -1).map((from, i) => ({
    label: i === DEPTH_BINS.length - 2 ? `${from}+` : `${from}–${DEPTH_BINS[i + 1]}`,
    count: 0,
    depthClass: depthClass(from).id,
  }));
  for (const q of earthquakes) {
    const depth = Math.max(0, q.depthKm);
    let idx = DEPTH_BINS.findIndex((edge, i) => i > 0 && depth < edge) - 1;
    if (idx < 0) idx = bins.length - 1;
    bins[idx].count += 1;
  }
  return bins;
}

export interface CategoryCount {
  id: SeverityLevel;
  label: string;
  range: string;
  color: string;
  count: number;
}

/** Event counts per magnitude category (severity band), least to most severe. */
export function magnitudeCategories(earthquakes: Earthquake[]): CategoryCount[] {
  const counts = new Map<SeverityLevel, number>(SEVERITIES.map((s) => [s.id, 0]));
  for (const q of earthquakes) counts.set(q.severity, (counts.get(q.severity) ?? 0) + 1);
  return SEVERITIES.map((s) => ({ id: s.id, label: s.label, range: s.range, color: s.color, count: counts.get(s.id) ?? 0 }));
}

/** Mapped facilities by type, across every OpenStreetMap result loaded in this session. */
export function facilityDistribution(facilities: Facility[]): { kind: FacilityKind; label: string; count: number }[] {
  const counts = new Map<FacilityKind, number>();
  for (const f of facilities) counts.set(f.kind, (counts.get(f.kind) ?? 0) + 1);
  return FACILITY_KINDS.map((k) => ({ kind: k.id, label: k.plural, count: counts.get(k.id) ?? 0 }));
}

/** Bounding box of a region's events, for zooming the map to that region. */
export function regionBounds(earthquakes: Earthquake[], region: string): [[number, number], [number, number]] | null {
  const events = earthquakes.filter((q) => regionOf(q.place) === region);
  if (events.length === 0) return null;
  const lats = events.map((q) => q.latitude);
  const lons = events.map((q) => q.longitude);
  // Regions such as the Aleutians straddle the antimeridian; shifting western longitudes by 360°
  // can give a much tighter box (MapLibre accepts longitudes beyond 180).
  const shifted = lons.map((lon) => (lon < 0 ? lon + 360 : lon));
  const span = (values: number[]) => Math.max(...values) - Math.min(...values);
  const best = span(shifted) < span(lons) ? shifted : lons;
  return [
    [Math.min(...best), Math.min(...lats)],
    [Math.max(...best), Math.max(...lats)],
  ];
}
