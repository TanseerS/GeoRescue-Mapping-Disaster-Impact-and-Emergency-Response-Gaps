import type { EarthquakeFeed, TimeRange, UsgsFeedResponse } from "../types/earthquake";
import { normalizeFeed } from "./usgs";

const API_TIMEOUT_MS = 15_000;

export interface IngestionStatus {
  lastSuccessfulIngestionAt: string | null;
  ageSeconds: number | null;
  stale: boolean;
  staleAfterSeconds: number;
  windowDays: number;
  lastAttempt: { at: number; status: "success" | "skipped" | "failure"; error?: string } | null;
  lastSuccessfulIngestion: { feedGenerated: number; feedCount: number; windowCount: number; durationMs: number } | null;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(API_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetch(url, { signal: combined, headers: { Accept: "application/json" } });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new Error(timeout.aborted ? "GeoRescue API timed out" : "GeoRescue API is unreachable");
  }
  if (!response.ok) {
    let detail = "";
    try {
      detail = ((await response.json()) as { error?: string }).error ?? "";
    } catch {
      // body is optional
    }
    throw new Error(`GeoRescue API responded with HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return (await response.json()) as T;
}

/** Loads earthquakes for a time range from the GeoRescue AWS API (served from the S3 rolling window). */
export async function fetchEarthquakesFromApi(baseUrl: string, range: TimeRange, signal?: AbortSignal): Promise<EarthquakeFeed> {
  const data = await getJson<UsgsFeedResponse>(`${baseUrl}/earthquakes?range=${range}`, signal);
  if (data?.type !== "FeatureCollection" || !Array.isArray(data.features)) {
    throw new Error("GeoRescue API returned an unexpected format");
  }
  return normalizeFeed(data, Date.now(), "aws-api");
}

export function fetchIngestionStatus(baseUrl: string, signal?: AbortSignal): Promise<IngestionStatus> {
  return getJson<IngestionStatus>(`${baseUrl}/earthquakes/metadata`, signal);
}
