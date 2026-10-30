import { env } from "../config/env";
import type { EarthquakeFeed, TimeRange } from "../types/earthquake";
import { fetchEarthquakesFromApi } from "./earthquakeApi";
import { fetchEarthquakes as fetchFromUsgs } from "./usgs";

export interface SourceOptions {
  apiBaseUrl: string;
  fallbackToUsgs: boolean;
}

/**
 * Loads earthquakes from the GeoRescue AWS API when VITE_API_BASE_URL is set, otherwise directly
 * from USGS. If the API fails and fallback is enabled, the direct USGS feed is used and the feed
 * is marked "usgs-fallback" so the UI can say so.
 */
export async function loadEarthquakes(
  range: TimeRange,
  signal?: AbortSignal,
  options: SourceOptions = { apiBaseUrl: env.apiBaseUrl, fallbackToUsgs: env.apiFallbackToUsgs },
): Promise<EarthquakeFeed> {
  if (!options.apiBaseUrl) return fetchFromUsgs(range, signal);
  try {
    return await fetchEarthquakesFromApi(options.apiBaseUrl, range, signal);
  } catch (err) {
    if (signal?.aborted || !options.fallbackToUsgs) throw err;
    const reason = (err as Error).message;
    console.warn(`GeoRescue API unavailable (${reason}); falling back to the direct USGS feed.`);
    const direct = await fetchFromUsgs(range, signal);
    return { ...direct, source: "usgs-fallback", fallbackReason: reason };
  }
}
