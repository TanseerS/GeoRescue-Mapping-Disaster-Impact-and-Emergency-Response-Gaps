import { gzipSync } from "node:zlib";
import type { EarthquakeCollection } from "../shared/geojson";
import type { IngestionMetadata } from "../ingest/ingest";
import { KEYS } from "../shared/keys";
import type { Logger } from "../shared/logger";
import type { ObjectStore } from "../shared/storage";
import { circlePolygon, TASK_ID_PATTERN, WORLDPOP_DATASET, type PopulationProvider } from "./population";

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGES = { day: DAY_MS, week: 7 * DAY_MS, month: 30 * DAY_MS } as const;
type Range = keyof typeof RANGES;

/** Lambda responses through API Gateway are limited to 6 MB; keep a safety margin. */
const MAX_RESPONSE_BYTES = 5.5 * 1024 * 1024;
const GZIP_MIN_BYTES = 1024;

export interface ApiConfig {
  /** Data older than this is reported as stale by /health and /earthquakes/metadata. */
  staleAfterSeconds: number;
  /** How long a warm Lambda reuses an S3 object before revalidating it with its ETag. */
  cacheTtlMs: number;
}

export interface ApiRequest {
  method: string;
  path: string;
  query: Record<string, string | undefined>;
  headers: Record<string, string | undefined>;
}

export interface ApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded: boolean;
}

export interface ApiDeps {
  store: ObjectStore;
  logger: Logger;
  now?: () => number;
  /** Optional: enables GET /population. */
  population?: PopulationProvider;
}

const POPULATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const POPULATION_CACHE_MAX = 500;
const MAX_POPULATION_RADIUS_KM = 50;

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
  }
}

interface CacheEntry<T> {
  etag: string;
  value: T;
  checkedAt: number;
}

/**
 * Creates the request handler. S3 objects are cached in memory across warm invocations and
 * revalidated with conditional GETs, so most requests cost no S3 data transfer.
 */
export function createApi(config: ApiConfig, deps: ApiDeps) {
  const now = deps.now ?? Date.now;
  const cache = new Map<string, CacheEntry<unknown>>();

  async function load<T>(key: string): Promise<T | null> {
    const cached = cache.get(key) as CacheEntry<T> | undefined;
    const t = now();
    if (cached && t - cached.checkedAt < config.cacheTtlMs) return cached.value;
    const result = cached ? await deps.store.getIfChanged(key, cached.etag) : await deps.store.get(key);
    if (result === "not-modified" && cached) {
      cached.checkedAt = t;
      return cached.value;
    }
    if (!result || result === "not-modified") {
      cache.delete(key);
      return null;
    }
    const value = JSON.parse(result.body) as T;
    cache.set(key, { etag: result.etag, value, checkedAt: t });
    return value;
  }

  function freshness(meta: IngestionMetadata | null) {
    const last = meta?.lastSuccessfulIngestion;
    if (!last) return { lastSuccessfulIngestionAt: null, ageSeconds: null, stale: true };
    const ageSeconds = Math.max(0, Math.round((now() - last.at) / 1000));
    return { lastSuccessfulIngestionAt: new Date(last.at).toISOString(), ageSeconds, stale: ageSeconds > config.staleAfterSeconds };
  }

  async function health(): Promise<{ status: number; body: unknown }> {
    try {
      const meta = await load<IngestionMetadata>(KEYS.metadata);
      const fresh = freshness(meta);
      const status = !meta?.lastSuccessfulIngestion ? "no-data" : fresh.stale ? "stale" : "ok";
      return {
        status: status === "ok" ? 200 : 503,
        body: {
          status,
          service: "georescue-api",
          time: new Date(now()).toISOString(),
          checks: {
            storage: "ok",
            ingestion: { ...fresh, lastAttempt: meta?.lastAttempt ?? null, staleAfterSeconds: config.staleAfterSeconds },
          },
        },
      };
    } catch (err) {
      deps.logger.error("health.storage.failed", { error: err });
      return { status: 503, body: { status: "error", service: "georescue-api", checks: { storage: "error" } } };
    }
  }

  async function metadata(): Promise<unknown> {
    const meta = await load<IngestionMetadata>(KEYS.metadata);
    if (!meta) throw new HttpError(404, "No ingestion has completed yet.", { "retry-after": "300" });
    return { ...meta, ...freshness(meta), staleAfterSeconds: config.staleAfterSeconds };
  }

  function parseQuery(query: ApiRequest["query"]) {
    const range = (query.range ?? "day") as Range;
    if (!(range in RANGES)) throw new HttpError(400, "range must be one of: day, week, month.");

    let since = now() - RANGES[range];
    if (query.since !== undefined) {
      const raw = query.since.trim();
      const parsed = /^\d+$/.test(raw) ? Number(raw) : Date.parse(raw);
      if (!Number.isFinite(parsed)) throw new HttpError(400, "since must be an ISO 8601 date or epoch milliseconds.");
      since = parsed;
    }

    let minMagnitude = -Infinity;
    if (query.minMagnitude !== undefined) {
      minMagnitude = Number(query.minMagnitude);
      if (query.minMagnitude.trim() === "" || !Number.isFinite(minMagnitude) || minMagnitude < -2 || minMagnitude > 10) {
        throw new HttpError(400, "minMagnitude must be a number between -2 and 10.");
      }
    }

    let limit = Infinity;
    if (query.limit !== undefined) {
      limit = Number(query.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 20_000) throw new HttpError(400, "limit must be an integer between 1 and 20000.");
    }
    return { range, since, minMagnitude, limit };
  }

  async function earthquakes(query: ApiRequest["query"]): Promise<unknown> {
    const params = parseQuery(query);
    const window = await load<EarthquakeCollection>(KEYS.window);
    if (!window) throw new HttpError(503, "Earthquake data has not been ingested yet. Retry shortly.", { "retry-after": "300" });

    const features = window.features
      .filter((f) => f.properties.time >= params.since)
      .filter((f) => params.minMagnitude === -Infinity || (f.properties.mag !== null && f.properties.mag >= params.minMagnitude))
      .slice(0, params.limit);

    return {
      type: "FeatureCollection",
      metadata: {
        ...window.metadata,
        title: `GeoRescue API · USGS earthquakes since ${new Date(params.since).toISOString()}`,
        count: features.length,
        range: params.range,
        since: params.since,
        minMagnitude: params.minMagnitude === -Infinity ? null : params.minMagnitude,
      },
      features,
    };
  }

  const populationCache = new Map<string, { value: number; at: number }>();
  const populationKey = (lat: number, lon: number, radiusKm: number) => `${lat.toFixed(3)},${lon.toFixed(3)},${radiusKm}`;

  function cachedPopulation(key: string): number | null {
    const hit = populationCache.get(key);
    return hit && now() - hit.at < POPULATION_CACHE_TTL_MS ? hit.value : null;
  }

  function cachePopulation(key: string, value: number) {
    if (populationCache.size >= POPULATION_CACHE_MAX) populationCache.delete(populationCache.keys().next().value as string);
    populationCache.set(key, { value, at: now() });
  }

  function populationParams(query: ApiRequest["query"]) {
    if (!deps.population) throw new HttpError(404, "Population estimates are not enabled.");
    const lat = Number(query.lat);
    const lon = Number(query.lon);
    if (query.lat === undefined || !Number.isFinite(lat) || Math.abs(lat) > 90) throw new HttpError(400, "lat must be a latitude between -90 and 90.");
    if (query.lon === undefined || !Number.isFinite(lon) || Math.abs(lon) > 180) throw new HttpError(400, "lon must be a longitude between -180 and 180.");
    const radii = (query.radii ?? "10,25,50").split(",").map((r) => Number(r.trim()));
    const valid =
      radii.length >= 1 &&
      radii.length <= 3 &&
      radii.every((r, i) => Number.isFinite(r) && r >= 1 && r <= MAX_POPULATION_RADIUS_KM && (i === 0 || r > radii[i - 1]));
    if (!valid) throw new HttpError(400, `radii must be 1–3 increasing values between 1 and ${MAX_POPULATION_RADIUS_KM} km.`);
    return { lat, lon, radii, provider: deps.population };
  }

  const populationResult = (radii: number[], totals: number[]) => ({
    status: "complete",
    ...WORLDPOP_DATASET,
    results: radii.map((radiusKm, i) => ({ radiusKm, population: Math.round(totals[i]) })),
  });

  /** Step 1: return cached estimates, or start WorldPop tasks and answer 202 with their ids. */
  async function population(query: ApiRequest["query"]): Promise<{ status: number; body: unknown }> {
    const { lat, lon, radii, provider } = populationParams(query);
    const cached = radii.map((r) => cachedPopulation(populationKey(lat, lon, r)));
    if (cached.every((v) => v !== null)) return { status: 200, body: populationResult(radii, cached as number[]) };
    try {
      const taskIds = await Promise.all(radii.map((r) => provider.submit(circlePolygon(lat, lon, r))));
      return { status: 202, body: { status: "pending", retryAfterMs: 3000, tasks: taskIds } };
    } catch (err) {
      deps.logger.warn("population.submit.failed", { error: err });
      throw new HttpError(502, "The WorldPop population service is unavailable. Retry shortly.");
    }
  }

  /** Step 2: poll WorldPop tasks; 200 with estimates once every task has finished. */
  async function populationTasks(query: ApiRequest["query"]): Promise<{ status: number; body: unknown }> {
    const { lat, lon, radii, provider } = populationParams(query);
    const ids = (query.ids ?? "").split(",").map((id) => id.trim());
    if (ids.length !== radii.length || !ids.every((id) => TASK_ID_PATTERN.test(id))) {
      throw new HttpError(400, "ids must list one WorldPop task id per radius.");
    }
    let statuses;
    try {
      statuses = await Promise.all(ids.map((id) => provider.status(id)));
    } catch (err) {
      deps.logger.warn("population.status.failed", { error: err });
      throw new HttpError(502, "The WorldPop population service is unavailable. Retry shortly.");
    }
    if (statuses.some((s) => s.state !== "finished")) return { status: 202, body: { status: "pending", retryAfterMs: 3000, tasks: ids } };
    const totals = statuses.map((s) => (s.state === "finished" ? s.total : 0));
    radii.forEach((r, i) => cachePopulation(populationKey(lat, lon, r), totals[i]));
    return { status: 200, body: populationResult(radii, totals) };
  }

  function respond(status: number, body: unknown, req: ApiRequest, cacheControl: string, extra: Record<string, string> = {}): ApiResponse {
    const json = JSON.stringify(body);
    const headers: Record<string, string> = {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheControl,
      "x-content-type-options": "nosniff",
      ...extra,
    };
    const acceptsGzip = /\bgzip\b/i.test(req.headers["accept-encoding"] ?? "");
    if (acceptsGzip && Buffer.byteLength(json) >= GZIP_MIN_BYTES) {
      const encoded = gzipSync(json).toString("base64");
      if (encoded.length > MAX_RESPONSE_BYTES) return tooLarge(req);
      return { statusCode: status, headers: { ...headers, "content-encoding": "gzip", vary: "accept-encoding" }, body: encoded, isBase64Encoded: true };
    }
    if (Buffer.byteLength(json) > MAX_RESPONSE_BYTES) return tooLarge(req);
    return { statusCode: status, headers, body: json, isBase64Encoded: false };
  }

  function tooLarge(req: ApiRequest): ApiResponse {
    return respond(413, { error: "Response too large. Narrow the range or add minMagnitude, or request gzip encoding." }, req, "no-store");
  }

  return async function handle(req: ApiRequest): Promise<ApiResponse> {
    const started = now();
    let response: ApiResponse;
    try {
      if (req.method !== "GET") throw new HttpError(405, "Method not allowed.", { allow: "GET" });
      switch (req.path.replace(/\/+$/, "") || "/") {
        case "/health": {
          const result = await health();
          response = respond(result.status, result.body, req, "no-store");
          break;
        }
        case "/earthquakes/metadata":
          response = respond(200, await metadata(), req, "public, max-age=30");
          break;
        case "/earthquakes":
          response = respond(200, await earthquakes(req.query), req, "public, max-age=60");
          break;
        case "/population": {
          const result = await population(req.query);
          response = respond(result.status, result.body, req, result.status === 200 ? "public, max-age=86400" : "no-store");
          break;
        }
        case "/population/tasks": {
          const result = await populationTasks(req.query);
          response = respond(result.status, result.body, req, result.status === 200 ? "public, max-age=86400" : "no-store");
          break;
        }
        default:
          throw new HttpError(404, "Not found.");
      }
    } catch (err) {
      if (err instanceof HttpError) {
        response = respond(err.statusCode, { error: err.message }, req, "no-store", err.headers);
      } else {
        deps.logger.error("api.request.failed", { path: req.path, error: err });
        response = respond(500, { error: "Internal server error." }, req, "no-store");
      }
    }
    deps.logger.info("api.request", {
      method: req.method,
      path: req.path,
      status: response.statusCode,
      durationMs: now() - started,
      gzip: response.isBase64Encoded,
    });
    return response;
  };
}
