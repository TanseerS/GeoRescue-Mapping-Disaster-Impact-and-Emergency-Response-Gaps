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

const POLL_TIMEOUT_MS = 120_000;

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

async function getJson(url: string, signal?: AbortSignal): Promise<{ status: number; body: Record<string, unknown> }> {
  let response: Response;
  try {
    response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new Error("GeoRescue API is unreachable.");
  }
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : `Population service responded with HTTP ${response.status}.`);
  return { status: response.status, body };
}

/**
 * Estimated residents within each radius, from the WorldPop gridded population dataset via the
 * GeoRescue API (WorldPop's service cannot be called from browsers directly). The API answers 202
 * while WorldPop tasks run; this polls until the estimate is ready.
 */
export async function fetchPopulation(
  apiBaseUrl: string,
  latitude: number,
  longitude: number,
  radii: readonly number[],
  signal?: AbortSignal,
  pollIntervalMs?: number,
): Promise<PopulationResponse> {
  const key = populationCacheKey(latitude, longitude, radii);
  const cached = cache.get(key);
  if (cached) return cached;

  const params = new URLSearchParams({ lat: latitude.toFixed(4), lon: longitude.toFixed(4), radii: radii.join(",") });
  // WorldPop task submission is occasionally slow enough to fail once; retry a single time before reporting.
  let first: Awaited<ReturnType<typeof getJson>>;
  try {
    first = await getJson(`${apiBaseUrl}/population?${params.toString()}`, signal);
  } catch (err) {
    if (signal?.aborted) throw err;
    await sleep(pollIntervalMs ?? 3000, signal);
    first = await getJson(`${apiBaseUrl}/population?${params.toString()}`, signal);
  }
  let { status, body } = first;
  const started = Date.now();
  while (status === 202) {
    if (Date.now() - started > POLL_TIMEOUT_MS) throw new Error("WorldPop is taking too long to respond. Retry shortly.");
    const tasks = Array.isArray(body.tasks) ? (body.tasks as string[]) : [];
    await sleep(pollIntervalMs ?? (typeof body.retryAfterMs === "number" ? body.retryAfterMs : 3000), signal);
    params.set("ids", tasks.join(","));
    ({ status, body } = await getJson(`${apiBaseUrl}/population/tasks?${params.toString()}`, signal));
  }
  if (!Array.isArray(body.results)) throw new Error("Population service returned an unexpected format.");
  const result = body as unknown as PopulationResponse;
  cache.set(key, result);
  return result;
}
