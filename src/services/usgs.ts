import { FEEDS } from "../config/constants";
import { env } from "../config/env";
import type { DataSource, Earthquake, EarthquakeFeed, TimeRange, UsgsFeature, UsgsFeedResponse } from "../types/earthquake";
import { getSeverity } from "../utils/severity";

export function feedUrl(range: TimeRange): string {
  return `${env.usgsBaseUrl}/${FEEDS[range].file}`;
}

export function normalizeFeature(feature: UsgsFeature): Earthquake | null {
  const { properties: p, geometry } = feature;
  if (!geometry || !Array.isArray(geometry.coordinates)) return null;
  const [longitude, latitude, depth] = geometry.coordinates;
  if (typeof p.mag !== "number" || !Number.isFinite(p.mag)) return null;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;

  return {
    id: feature.id,
    magnitude: p.mag,
    magnitudeType: p.magType ?? null,
    place: p.place?.trim() || p.title?.trim() || "Unnamed location",
    time: p.time,
    updated: p.updated,
    longitude,
    latitude,
    depthKm: Number.isFinite(depth) ? depth : 0,
    url: p.url ?? null,
    tsunami: p.tsunami === 1,
    alert: p.alert ?? null,
    felt: p.felt ?? null,
    significance: p.sig ?? null,
    status: p.status ?? null,
    severity: getSeverity(p.mag),
  };
}

export function normalizeFeed(
  data: UsgsFeedResponse,
  fetchedAt: number = Date.now(),
  source: DataSource = "usgs-direct",
  fallbackReason: string | null = null,
): EarthquakeFeed {
  const earthquakes: Earthquake[] = [];
  let skipped = 0;
  for (const feature of data.features ?? []) {
    const quake = normalizeFeature(feature);
    if (quake) earthquakes.push(quake);
    else skipped += 1;
  }
  earthquakes.sort((a, b) => b.time - a.time);
  return {
    source,
    fallbackReason,
    ingestedAt: typeof data.metadata?.ingestedAt === "number" ? data.metadata.ingestedAt : null,
    earthquakes,
    generatedAt: data.metadata?.generated ?? fetchedAt,
    fetchedAt,
    skipped,
    title: data.metadata?.title ?? "USGS Earthquakes",
  };
}

/** Fetches the USGS summary feed directly from the browser. */
export async function fetchEarthquakes(range: TimeRange, signal?: AbortSignal): Promise<EarthquakeFeed> {
  let response: Response;
  try {
    response = await fetch(feedUrl(range), { signal, headers: { Accept: "application/geo+json, application/json" } });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new Error("Unable to reach the USGS earthquake feed. Check your network connection and try again.");
  }
  if (!response.ok) {
    throw new Error(`USGS feed responded with HTTP ${response.status}. Please retry shortly.`);
  }
  const data = (await response.json()) as UsgsFeedResponse;
  if (data?.type !== "FeatureCollection" || !Array.isArray(data.features)) {
    throw new Error("USGS feed returned an unexpected format.");
  }
  return normalizeFeed(data);
}
