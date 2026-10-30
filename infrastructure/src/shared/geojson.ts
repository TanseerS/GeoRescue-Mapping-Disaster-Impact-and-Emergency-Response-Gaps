/**
 * USGS GeoJSON handling shared by the ingestion and API functions.
 * Original USGS feature properties and coordinates are preserved verbatim; normalization only
 * rejects malformed records, removes duplicates and orders features newest first.
 */

export interface EarthquakeFeature {
  type: "Feature";
  id: string;
  properties: Record<string, unknown> & {
    mag: number | null;
    place: string | null;
    time: number;
    updated: number;
  };
  geometry: { type: "Point"; coordinates: number[] };
}

export interface CollectionMetadata {
  /** USGS feed generation time (epoch ms). */
  generated: number;
  title: string;
  count: number;
  /** URL of the USGS feed the data came from. */
  url: string;
  /** When GeoRescue stored this collection (epoch ms). */
  ingestedAt: number;
  source: "georescue-api";
  [key: string]: unknown;
}

export interface EarthquakeCollection {
  type: "FeatureCollection";
  metadata: CollectionMetadata;
  features: EarthquakeFeature[];
}

export class FeedValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeedValidationError";
  }
}

export interface ValidatedFeed {
  generated: number;
  title: string;
  rawFeatures: unknown[];
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Checks the top-level shape of a USGS summary feed response. */
export function validateFeed(data: unknown): ValidatedFeed {
  if (!isRecord(data)) throw new FeedValidationError("Feed is not a JSON object");
  if (data.type !== "FeatureCollection") throw new FeedValidationError(`Unexpected feed type: ${String(data.type)}`);
  if (!Array.isArray(data.features)) throw new FeedValidationError("Feed has no features array");
  const metadata = isRecord(data.metadata) ? data.metadata : {};
  if (!isFiniteNumber(metadata.generated)) throw new FeedValidationError("Feed metadata.generated is missing");
  return {
    generated: metadata.generated,
    title: typeof metadata.title === "string" ? metadata.title : "USGS Earthquakes",
    rawFeatures: data.features,
  };
}

/** Returns a valid feature (same object references for properties/coordinates) or null. */
export function validateFeature(raw: unknown): EarthquakeFeature | null {
  if (!isRecord(raw) || raw.type !== "Feature") return null;
  if (typeof raw.id !== "string" || raw.id.length === 0) return null;
  const props = raw.properties;
  const geom = raw.geometry;
  if (!isRecord(props) || !isRecord(geom) || geom.type !== "Point" || !Array.isArray(geom.coordinates)) return null;
  const [lon, lat] = geom.coordinates as unknown[];
  if (!isFiniteNumber(lon) || !isFiniteNumber(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) return null;
  if (!isFiniteNumber(props.time)) return null;
  if (props.mag !== null && props.mag !== undefined && !isFiniteNumber(props.mag)) return null;

  return {
    type: "Feature",
    id: raw.id,
    properties: {
      ...props,
      mag: isFiniteNumber(props.mag) ? props.mag : null,
      place: typeof props.place === "string" ? props.place : null,
      time: props.time,
      updated: isFiniteNumber(props.updated) ? props.updated : props.time,
    },
    geometry: { type: "Point", coordinates: geom.coordinates as number[] },
  };
}

export interface NormalizeResult {
  features: EarthquakeFeature[];
  rejected: number;
  duplicates: number;
}

/** Validates every feature, keeps the most recently updated copy of each id, sorts newest first. */
export function normalizeFeatures(rawFeatures: unknown[]): NormalizeResult {
  const byId = new Map<string, EarthquakeFeature>();
  let rejected = 0;
  let duplicates = 0;
  for (const raw of rawFeatures) {
    const feature = validateFeature(raw);
    if (!feature) {
      rejected += 1;
      continue;
    }
    const existing = byId.get(feature.id);
    if (existing) {
      duplicates += 1;
      if (feature.properties.updated < existing.properties.updated) continue;
    }
    byId.set(feature.id, feature);
  }
  return { features: sortNewestFirst([...byId.values()]), rejected, duplicates };
}

function sortNewestFirst(features: EarthquakeFeature[]): EarthquakeFeature[] {
  return features.sort((a, b) => b.properties.time - a.properties.time);
}

export interface MergeOptions {
  /** Generation time of the incoming feed (epoch ms). */
  feedGenerated: number;
  /** Time span the incoming feed covers (24 h for all_day). */
  feedCoverageMs: number;
  /** Rolling window length to retain. */
  windowMs: number;
}

export interface MergeResult {
  features: EarthquakeFeature[];
  added: number;
  updated: number;
  /** Events that disappeared from the feed's coverage period (deleted upstream by USGS). */
  removed: number;
  /** Events that aged out of the rolling window. */
  expired: number;
}

/** Margin at the edge of the feed's coverage where absence is not treated as an upstream deletion. */
const COVERAGE_SAFETY_MARGIN_MS = 30 * 60 * 1000;

/**
 * Merges a fresh feed into the rolling window. Idempotent: merging the same feed twice yields the
 * same result, so duplicate or overlapping ingestion runs cannot corrupt the window.
 */
export function mergeWindow(existing: EarthquakeFeature[], incoming: EarthquakeFeature[], options: MergeOptions): MergeResult {
  const windowStart = options.feedGenerated - options.windowMs;
  const coverageStart = options.feedGenerated - options.feedCoverageMs + COVERAGE_SAFETY_MARGIN_MS;
  const incomingIds = new Set(incoming.map((f) => f.id));
  const merged = new Map<string, EarthquakeFeature>();
  let removed = 0;
  let expired = 0;

  for (const feature of existing) {
    const time = feature.properties.time;
    if (time < windowStart) {
      expired += 1;
    } else if (time >= coverageStart && !incomingIds.has(feature.id)) {
      removed += 1;
    } else {
      merged.set(feature.id, feature);
    }
  }

  let added = 0;
  let updated = 0;
  for (const feature of incoming) {
    if (feature.properties.time < windowStart) continue;
    const current = merged.get(feature.id);
    if (!current) {
      added += 1;
      merged.set(feature.id, feature);
    } else if (feature.properties.updated > current.properties.updated) {
      updated += 1;
      merged.set(feature.id, feature);
    }
  }

  return { features: sortNewestFirst([...merged.values()]), added, updated, removed, expired };
}
