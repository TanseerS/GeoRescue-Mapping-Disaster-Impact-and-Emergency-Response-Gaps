import { createTtlCache } from "../utils/storage";

export interface PopulationEstimate {
  radiusKm: number;
  population: number;
}

export interface PopulationResponse {
  dataset: string;
  year: number;
  resolution: string;
  license: string;
  sourceUrl: string;
  results: PopulationEstimate[];
}

const cache = createTtlCache<PopulationResponse>("georescue:population:v1", 7 * 24 * 60 * 60 * 1000, 60);

export function populationCacheKey(latitude: number, longitude: number, radii: readonly number[]) {
  return `${latitude.toFixed(3)},${longitude.toFixed(3)}:${radii.join(",")}`;
}

/**
 * Estimated residents within each radius, from the WorldPop gridded population dataset via the
 * GeoRescue API (WorldPop's service cannot be called from browsers directly).
 */
export async function fetchPopulation(
  apiBaseUrl: string,
  latitude: number,
  longitude: number,
  radii: readonly number[],
  signal?: AbortSignal,
): Promise<PopulationResponse> {
  const key = populationCacheKey(latitude, longitude, radii);
  const cached = cache.get(key);
  if (cached) return cached;
  const params = new URLSearchParams({ lat: latitude.toFixed(4), lon: longitude.toFixed(4), radii: radii.join(",") });
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/population?${params.toString()}`, { signal, headers: { Accept: "application/json" } });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new Error("GeoRescue API is unreachable.");
  }
  const body = (await response.json().catch(() => ({}))) as Partial<PopulationResponse> & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Population service responded with HTTP ${response.status}.`);
  if (!Array.isArray(body.results)) throw new Error("Population service returned an unexpected format.");
  const result = body as PopulationResponse;
  cache.set(key, result);
  return result;
}
