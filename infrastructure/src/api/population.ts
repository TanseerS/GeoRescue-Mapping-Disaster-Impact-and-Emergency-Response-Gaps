/**
 * Population exposure via the WorldPop stats service. WorldPop's API sends no CORS headers (and may
 * prefix its JSON with PHP notices), so the browser calls this through the GeoRescue API instead.
 */

export const WORLDPOP_DATASET = {
  dataset: "WorldPop Global Population (unconstrained)",
  year: 2020,
  resolution: "3 arc-second grid (~100 m)",
  license: "CC BY 4.0",
  sourceUrl: "https://www.worldpop.org/",
} as const;

const EARTH_RADIUS_KM = 6371.0088;

/** Closed polygon ring approximating a geodesic circle (spherical earth). */
export function circlePolygon(latitude: number, longitude: number, radiusKm: number, steps = 48): [number, number][] {
  const lat1 = (latitude * Math.PI) / 180;
  const lon1 = (longitude * Math.PI) / 180;
  const d = radiusKm / EARTH_RADIUS_KM;
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const bearing = (2 * Math.PI * (i % steps)) / steps;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing));
    const lon2 = lon1 + Math.atan2(Math.sin(bearing) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    ring.push([Number(((lon2 * 180) / Math.PI).toFixed(5)), Number(((lat2 * 180) / Math.PI).toFixed(5))]);
  }
  return ring;
}

export type TaskStatus = { state: "pending" } | { state: "finished"; total: number };

/**
 * WorldPop's synchronous mode can exceed API Gateway's 30 s limit, so estimates run as WorldPop
 * async tasks: submit returns a task id quickly and status is polled until the task finishes.
 */
export interface PopulationProvider {
  submit(ring: [number, number][]): Promise<string>;
  status(taskId: string): Promise<TaskStatus>;
}

type FetchText = (url: string, init: { signal: AbortSignal; headers: Record<string, string> }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/** Extracts the JSON object from a response body that may be wrapped in PHP warnings. */
export function extractJson(body: string): unknown {
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("WorldPop response contained no JSON");
  return JSON.parse(body.slice(start, end + 1));
}

export const TASK_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface WorldPopBody {
  status?: string;
  error?: boolean;
  error_message?: string | null;
  taskid?: string;
  data?: { total_population?: unknown };
}

export function createWorldPopProvider(options: { fetch?: FetchText; baseUrl?: string; timeoutMs?: number } = {}): PopulationProvider {
  const doFetch = options.fetch ?? (globalThis.fetch as unknown as FetchText);
  const baseUrl = (options.baseUrl ?? "https://api.worldpop.org/v1").replace(/\/$/, "");
  // Stays under the API Lambda timeout (28 s) and the 30 s HTTP API integration limit.
  const timeoutMs = options.timeoutMs ?? 25_000;

  async function getJson(url: string): Promise<WorldPopBody> {
    const res = await doFetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: "application/json", "User-Agent": "GeoRescue/1.0" } });
    if (!res.ok) throw new Error(`WorldPop responded with HTTP ${res.status}`);
    const body = extractJson(await res.text()) as WorldPopBody;
    if (body.error) throw new Error(`WorldPop error: ${body.error_message ?? "unknown"}`);
    return body;
  }

  return {
    async submit(ring) {
      const geojson = { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } }] };
      const params = new URLSearchParams({ dataset: "wpgppop", year: String(WORLDPOP_DATASET.year), geojson: JSON.stringify(geojson), runasync: "true" });
      const body = await getJson(`${baseUrl}/services/stats?${params.toString()}`);
      if (!body.taskid || !TASK_ID_PATTERN.test(body.taskid)) throw new Error("WorldPop did not return a task id");
      return body.taskid;
    },
    async status(taskId) {
      if (!TASK_ID_PATTERN.test(taskId)) throw new Error("Invalid task id");
      const body = await getJson(`${baseUrl}/tasks/${taskId}`);
      if (body.status !== "finished") return { state: "pending" };
      const total = body.data?.total_population;
      if (typeof total !== "number" || !Number.isFinite(total) || total < 0) throw new Error("WorldPop returned no population total");
      return { state: "finished", total };
    },
  };
}
