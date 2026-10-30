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

const TASK = "b1918a95-ccec-5fdc-a9e8-fd06e361f0cb";
const TASK2 = "91e19ca2-bfba-5793-be95-d63e3241bf96";

describe("WorldPop provider", () => {
  const body = (json: unknown) => `${PHP_NOISE}${JSON.stringify(json)}<br />`;
  const fetchReturning = (status: number, text: string) => async () => ({ ok: status < 400, status, text: async () => text });

  it("extracts JSON wrapped in PHP warnings", () => {
    expect(extractJson(body({ data: { total_population: 12 } }))).toEqual({ data: { total_population: 12 } });
    expect(() => extractJson("<br />no json here")).toThrow("no JSON");
  });

  it("submits an async stats task with the polygon as GeoJSON", async () => {
    let url = "";
    const provider = createWorldPopProvider({
      fetch: async (u) => {
        url = u;
        return { ok: true, status: 200, text: async () => body({ status: "created", error: false, taskid: TASK }) };
      },
    });
    expect(await provider.submit(circlePolygon(37.77, -122.42, 10))).toBe(TASK);
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/v1/services/stats");
    expect(parsed.searchParams.get("dataset")).toBe("wpgppop");
    expect(parsed.searchParams.get("runasync")).toBe("true");
    expect(JSON.parse(parsed.searchParams.get("geojson")!).features[0].geometry.type).toBe("Polygon");
  });

  it("reports pending and finished task status", async () => {
    const pending = createWorldPopProvider({ fetch: fetchReturning(200, body({ status: "started", error: false, taskid: TASK })) });
    expect(await pending.status(TASK)).toEqual({ state: "pending" });
    const done = createWorldPopProvider({ fetch: fetchReturning(200, body({ status: "finished", error: false, data: { total_population: 307069.5 } })) });
    expect(await done.status(TASK)).toEqual({ state: "finished", total: 307069.5 });
  });

  it("rejects upstream errors, missing totals and malformed task ids", async () => {
    await expect(createWorldPopProvider({ fetch: fetchReturning(500, "") }).submit([])).rejects.toThrow("HTTP 500");
    await expect(createWorldPopProvider({ fetch: fetchReturning(200, body({ error: true, error_message: "too large" })) }).submit([])).rejects.toThrow("too large");
    await expect(createWorldPopProvider({ fetch: fetchReturning(200, body({ status: "finished", data: {} })) }).status(TASK)).rejects.toThrow("no population total");
    await expect(createWorldPopProvider({ fetch: fetchReturning(200, "{}") }).status("../../etc")).rejects.toThrow("Invalid task id");
  });
});

describe("population routes", () => {
  const request = (path: string, query: Record<string, string>) => ({ method: "GET", path, query, headers: {} });

  function fakeProvider(totals: Record<string, number>, pendingPolls = 0): PopulationProvider & { submits: number } {
    let polls = 0;
    const ids = [TASK, TASK2, "0e7f9d6a-1111-2222-3333-444455556666"];
    const provider = {
      submits: 0,
      async submit() {
        return ids[provider.submits++ % ids.length];
      },
      async status(taskId: string) {
        polls += 1;
        return polls <= pendingPolls ? ({ state: "pending" } as const) : ({ state: "finished", total: totals[taskId] } as const);
      },
    };
    return provider;
  }

  function api(provider?: PopulationProvider) {
    return createApi({ staleAfterSeconds: 900, cacheTtlMs: 30_000 }, { store: new MemoryObjectStore(), logger: silentLogger, population: provider });
  }

  it("starts tasks, reports pending, then returns rounded estimates and caches them", async () => {
    const provider = fakeProvider({ [TASK]: 1000.4, [TASK2]: 5000.6 }, 1);
    const handle = api(provider);
    const start = await handle(request("/population", { lat: "35.68", lon: "139.69", radii: "5,10" }));
    expect(start.statusCode).toBe(202);
    const { tasks } = JSON.parse(start.body);
    expect(tasks).toEqual([TASK, TASK2]);

    const poll = { lat: "35.68", lon: "139.69", radii: "5,10", ids: tasks.join(",") };
    expect((await handle(request("/population/tasks", poll))).statusCode).toBe(202);
    const done = await handle(request("/population/tasks", poll));
    expect(done.statusCode).toBe(200);
    expect(JSON.parse(done.body)).toMatchObject({ status: "complete", year: 2020, license: "CC BY 4.0", results: [{ radiusKm: 5, population: 1000 }, { radiusKm: 10, population: 5001 }] });

    const cached = await handle(request("/population", { lat: "35.68", lon: "139.69", radii: "5,10" }));
    expect(cached.statusCode).toBe(200);
    expect(provider.submits).toBe(2);
  });

  it("validates coordinates, radii and task ids", async () => {
    const handle = api(fakeProvider({}));
    const invalid: Record<string, string>[] = [{ lon: "1" }, { lat: "91", lon: "0" }, { lat: "0", lon: "0", radii: "10,5" }, { lat: "0", lon: "0", radii: "80" }];
    for (const q of invalid) expect((await handle(request("/population", q))).statusCode).toBe(400);
    expect((await handle(request("/population/tasks", { lat: "0", lon: "0", radii: "10", ids: "not-a-uuid" }))).statusCode).toBe(400);
    expect((await handle(request("/population/tasks", { lat: "0", lon: "0", radii: "10,20", ids: TASK }))).statusCode).toBe(400);
  });

  it("returns 502 when WorldPop fails and 404 when not enabled", async () => {
    const failing = api({ submit: async () => Promise.reject(new Error("timeout")), status: async () => Promise.reject(new Error("boom")) });
    const res = await failing(request("/population", { lat: "0", lon: "0" }));
    expect(res.statusCode).toBe(502);
    expect(res.body).not.toContain("timeout");
    expect((await failing(request("/population/tasks", { lat: "0", lon: "0", radii: "10", ids: TASK }))).statusCode).toBe(502);
    expect((await api()(request("/population", { lat: "0", lon: "0" }))).statusCode).toBe(404);
  });
});
