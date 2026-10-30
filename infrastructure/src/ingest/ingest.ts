import { historyKey, KEYS } from "../shared/keys";
import {
  mergeWindow,
  normalizeFeatures,
  type EarthquakeCollection,
  type EarthquakeFeature,
} from "../shared/geojson";
import type { Logger } from "../shared/logger";
import { PreconditionFailedError, type ObjectStore } from "../shared/storage";
import { fetchUsgsFeed, type FetchFeedOptions } from "./usgsClient";

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_WRITE_ATTEMPTS = 3;

export interface IngestionConfig {
  usgsBaseUrl: string;
  windowDays: number;
}

export interface IngestionDeps {
  store: ObjectStore;
  logger: Logger;
  now?: () => number;
  fetchOptions?: FetchFeedOptions;
}

export interface IngestionRecord {
  at: number;
  feedGenerated: number;
  feedUrl: string;
  durationMs: number;
  feedCount: number;
  rejected: number;
  duplicates: number;
  windowCount: number;
  windowStart: number;
  added: number;
  updated: number;
  removed: number;
  expired: number;
  seeded: boolean;
  historyKey: string;
  historyWritten: boolean;
}

export interface IngestionMetadata {
  schemaVersion: 1;
  lastSuccessfulIngestion: IngestionRecord | null;
  lastAttempt: { at: number; status: "success" | "skipped" | "failure"; durationMs: number; error?: string };
  windowDays: number;
  keys: typeof KEYS;
}

export type IngestionResult =
  | { status: "success"; record: IngestionRecord }
  | { status: "skipped"; reason: string; feedGenerated: number };

function collection(features: EarthquakeFeature[], meta: { generated: number; title: string; url: string; ingestedAt: number }, extra = {}): EarthquakeCollection {
  return {
    type: "FeatureCollection",
    metadata: { ...meta, count: features.length, source: "georescue-api", ...extra },
    features,
  };
}

async function readJson<T>(store: ObjectStore, key: string): Promise<{ value: T; etag: string } | null> {
  const obj = await store.get(key);
  return obj ? { value: JSON.parse(obj.body) as T, etag: obj.etag } : null;
}

/**
 * One ingestion run:
 *  1. Fetch + validate + normalize the USGS all_day feed (with retries).
 *  2. Skip if this feed generation was already ingested (duplicate/overlapping runs).
 *  3. Merge into the rolling window with optimistic concurrency (S3 If-Match), seeding it from
 *     all_month on the first run.
 *  4. Write latest.geojson, an hourly history snapshot (never overwritten) and metadata.
 */
export async function runIngestion(config: IngestionConfig, deps: IngestionDeps): Promise<IngestionResult> {
  const now = deps.now ?? Date.now;
  const { store, logger } = deps;
  const startedAt = now();
  const dayUrl = `${config.usgsBaseUrl}/all_day.geojson`;

  const metadata = await readJson<IngestionMetadata>(store, KEYS.metadata);
  const day = await fetchUsgsFeed(dayUrl, { ...deps.fetchOptions, logger });
  const normalized = normalizeFeatures(day.rawFeatures);

  const previousGenerated = metadata?.value.lastSuccessfulIngestion?.feedGenerated ?? 0;
  if (previousGenerated >= day.generated) {
    logger.info("ingestion.skipped", { reason: "feed-already-ingested", feedGenerated: day.generated, previousGenerated });
    return { status: "skipped", reason: "feed-already-ingested", feedGenerated: day.generated };
  }

  const windowMs = config.windowDays * DAY_MS;
  let seeded = false;
  let merge: ReturnType<typeof mergeWindow> | null = null;

  for (let attempt = 1; attempt <= WINDOW_WRITE_ATTEMPTS && !merge; attempt += 1) {
    const current = await readJson<EarthquakeCollection>(store, KEYS.window);
    let base = current?.value.features ?? [];
    if (!current) {
      const monthUrl = `${config.usgsBaseUrl}/all_month.geojson`;
      const month = await fetchUsgsFeed(monthUrl, { ...deps.fetchOptions, logger });
      base = normalizeFeatures(month.rawFeatures).features;
      seeded = true;
      logger.info("ingestion.window.seeded", { source: monthUrl, count: base.length });
    }
    const result = mergeWindow(base, normalized.features, {
      feedGenerated: day.generated,
      feedCoverageMs: DAY_MS,
      windowMs,
    });
    const body = JSON.stringify(
      collection(result.features, { generated: day.generated, title: `GeoRescue rolling ${config.windowDays}-day window`, url: dayUrl, ingestedAt: now() }, { windowDays: config.windowDays }),
    );
    try {
      await store.put(KEYS.window, body, current ? { ifMatch: current.etag } : { ifNoneMatch: "*" });
      merge = result;
    } catch (err) {
      if (!(err instanceof PreconditionFailedError) || attempt === WINDOW_WRITE_ATTEMPTS) throw err;
      logger.warn("ingestion.window.conflict", { attempt, message: "Window changed concurrently; re-merging" });
    }
  }
  if (!merge) throw new Error("Rolling window could not be written");

  const ingestedAt = now();
  const latestBody = JSON.stringify(collection(normalized.features, { generated: day.generated, title: day.title, url: dayUrl, ingestedAt }));
  await store.put(KEYS.latest, latestBody);

  const snapshotKey = historyKey(day.generated);
  let historyWritten = true;
  try {
    await store.put(snapshotKey, latestBody, { ifNoneMatch: "*" });
  } catch (err) {
    if (!(err instanceof PreconditionFailedError)) throw err;
    historyWritten = false; // first snapshot of the hour is kept; history is never overwritten
  }

  const record: IngestionRecord = {
    at: ingestedAt,
    feedGenerated: day.generated,
    feedUrl: dayUrl,
    durationMs: ingestedAt - startedAt,
    feedCount: normalized.features.length,
    rejected: normalized.rejected,
    duplicates: normalized.duplicates,
    windowCount: merge.features.length,
    windowStart: day.generated - windowMs,
    added: merge.added,
    updated: merge.updated,
    removed: merge.removed,
    expired: merge.expired,
    seeded,
    historyKey: snapshotKey,
    historyWritten,
  };

  const nextMetadata: IngestionMetadata = {
    schemaVersion: 1,
    lastSuccessfulIngestion: record,
    lastAttempt: { at: ingestedAt, status: "success", durationMs: record.durationMs },
    windowDays: config.windowDays,
    keys: KEYS,
  };
  try {
    await store.put(KEYS.metadata, JSON.stringify(nextMetadata), metadata ? { ifMatch: metadata.etag } : { ifNoneMatch: "*" });
  } catch (err) {
    if (!(err instanceof PreconditionFailedError)) throw err;
    // Another run committed metadata concurrently; its data is at least as new as ours.
    logger.warn("ingestion.metadata.conflict", { feedGenerated: day.generated });
  }

  logger.info("ingestion.completed", { ...record });
  return { status: "success", record };
}

/** Records a failed attempt without discarding the last successful ingestion (best effort). */
export async function recordFailure(store: ObjectStore, error: Error, startedAt: number, now: number, windowDays: number, logger: Logger) {
  try {
    const existing = await readJson<IngestionMetadata>(store, KEYS.metadata);
    const next: IngestionMetadata = {
      schemaVersion: 1,
      lastSuccessfulIngestion: existing?.value.lastSuccessfulIngestion ?? null,
      lastAttempt: { at: now, status: "failure", durationMs: now - startedAt, error: error.message },
      windowDays,
      keys: KEYS,
    };
    await store.put(KEYS.metadata, JSON.stringify(next), existing ? { ifMatch: existing.etag } : { ifNoneMatch: "*" });
  } catch (err) {
    logger.warn("ingestion.failure-record.skipped", { error: err });
  }
}
