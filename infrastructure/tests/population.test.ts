import { describe, expect, it } from "vitest";
import { createApi } from "../src/api/api";
import { circlePolygon, createWorldPopProvider, extractJson, type PopulationProvider } from "../src/api/population";
import { MemoryObjectStore } from "../src/shared/storage";
import { silentLogger } from "./fixtures";

const PHP_NOISE = "<br />\n<b>Deprecated</b>: Return type of Pimple\\Container::offsetExists($id) ... on line <b>133</b><br />\n";

function haversineKm([lon1, lat1]: number[], [lon2, lat2]: number[]) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lon2 - lon1) / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.sqrt(a));
}

describe("circlePolygon", () => {
  it("builds a closed ring whose vertices are at the requested radius", () => {
    const ring = circlePolygon(35.68, 139.69, 25);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    for (const p of ring) expect(haversineKm([139.69, 35.68], p)).toBeCloseTo(25, 0);
  });
});

describe("WorldPop provider", () => {
  const body = (json: unknown) => `${PHP_NOISE}${JSON.stringify(json)}<br />`;
  const fetchReturning = (status: number, text: string) => async () => ({ ok: status < 400, status, text: async () => text });

  it("extracts JSON wrapped in PHP warnings", () => {
    expect(extractJson(body({ data: { total_population: 12 } }))).toEqual({ data: { total_population: 12 } });
    expect(() => extractJson("<br />no json here")).toThrow("no JSON");
  });

  it("returns total_population and sends the polygon as GeoJSON", async () => {
    let url = "";
    const provider = createWorldPopProvider({
      fetch: async (u) => {
        url = u;
        return { ok: true, status: 200, text: async () => body({ error: false, data: { total_population: 307069.5 } }) };
      },
    });
    expect(await provider.totalPopulation(circlePolygon(37.77, -122.42, 10))).toBe(307069.5);
    const params = new URL(url).searchParams;
    expect(params.get("dataset")).toBe("wpgppop");
    expect(params.get("year")).toBe("2020");
    expect(JSON.parse(params.get("geojson")!).features[0].geometry.type).toBe("Polygon");
  });

  it("rejects upstream errors and missing totals", async () => {
    await expect(createWorldPopProvider({ fetch: fetchReturning(500, "") }).totalPopulation([])).rejects.toThrow("HTTP 500");
    await expect(
      createWorldPopProvider({ fetch: fetchReturning(200, body({ error: true, error_message: "too large" })) }).totalPopulation([]),
    ).rejects.toThrow("too large");
    await expect(createWorldPopProvider({ fetch: fetchReturning(200, body({ data: {} })) }).totalPopulation([])).rejects.toThrow("no population total");
  });
});

describe("GET /population", () => {
  const request = (query: Record<string, string>) => ({ method: "GET", path: "/population", query, headers: {} });

  function api(provider?: PopulationProvider) {
    return createApi({ staleAfterSeconds: 900, cacheTtlMs: 30_000 }, { store: new MemoryObjectStore(), logger: silentLogger, population: provider });
  }

  it("returns rounded estimates per radius with dataset attribution, caching repeated lookups", async () => {
    let calls = 0;
    const handle = api({ totalPopulation: async (ring) => (calls++, ring.length * 1000.4) });
    const res = await handle(request({ lat: "35.68", lon: "139.69", radii: "5,10,20" }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({ year: 2020, license: "CC BY 4.0", results: [{ radiusKm: 5 }, { radiusKm: 10 }, { radiusKm: 20 }] });
    expect(Number.isInteger(body.results[0].population)).toBe(true);
    await handle(request({ lat: "35.68", lon: "139.69", radii: "5,10,20" }));
    expect(calls).toBe(3);
  });

  it("validates coordinates and radii", async () => {
    const handle = api({ totalPopulation: async () => 1 });
    const invalid: Record<string, string>[] = [{ lon: "1" }, { lat: "91", lon: "0" }, { lat: "0", lon: "0", radii: "10,5" }, { lat: "0", lon: "0", radii: "80" }];
    for (const q of invalid) expect((await handle(request(q))).statusCode).toBe(400);
  });

  it("returns 502 when WorldPop fails and 404 when not enabled", async () => {
    const failing = api({ totalPopulation: async () => Promise.reject(new Error("timeout")) });
    const res = await failing(request({ lat: "0", lon: "0" }));
    expect(res.statusCode).toBe(502);
    expect(res.body).not.toContain("timeout");
    expect((await api()(request({ lat: "0", lon: "0" }))).statusCode).toBe(404);
  });
});
