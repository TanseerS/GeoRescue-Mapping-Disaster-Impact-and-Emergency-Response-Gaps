/**
 * Population exposure via the WorldPop stats service. WorldPop's API sends no CORS headers (and may
 * prefix its JSON with PHP notices), so the browser calls this through the GeoRescue API instead.
 */

export const WORLDPOP_DATASET = {
  dataset: "WorldPop Global Population (unconstrained)",
  year: 2020,
  resolution: "3 arc-second grid (~100 m)",
  license: "CC BY 4.0",
  sourceUrl: "https://hub.worldpop.org/geodata/listing?id=64",
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

export interface PopulationProvider {
  totalPopulation(ring: [number, number][]): Promise<number>;
}

type FetchText = (url: string, init: { signal: AbortSignal; headers: Record<string, string> }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/** Extracts the JSON object from a response body that may be wrapped in PHP warnings. */
export function extractJson(body: string): unknown {
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("WorldPop response contained no JSON");
  return JSON.parse(body.slice(start, end + 1));
}

export function createWorldPopProvider(options: { fetch?: FetchText; baseUrl?: string; timeoutMs?: number } = {}): PopulationProvider {
  const doFetch = options.fetch ?? (globalThis.fetch as unknown as FetchText);
  const baseUrl = options.baseUrl ?? "https://api.worldpop.org/v1/services/stats";
  const timeoutMs = options.timeoutMs ?? 20_000;
  return {
    async totalPopulation(ring) {
      const geojson = { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } }] };
      const params = new URLSearchParams({ dataset: "wpgppop", year: String(WORLDPOP_DATASET.year), geojson: JSON.stringify(geojson), runasync: "false" });
      const res = await doFetch(`${baseUrl}?${params.toString()}`, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Accept: "application/json", "User-Agent": "GeoRescue/1.0" },
      });
      if (!res.ok) throw new Error(`WorldPop responded with HTTP ${res.status}`);
      const data = extractJson(await res.text()) as { error?: boolean; error_message?: string | null; data?: { total_population?: unknown } };
      if (data.error) throw new Error(`WorldPop error: ${data.error_message ?? "unknown"}`);
      const total = data.data?.total_population;
      if (typeof total !== "number" || !Number.isFinite(total) || total < 0) throw new Error("WorldPop returned no population total");
      return total;
    },
  };
}
