import { gunzipSync } from "node:zlib";
import { beforeEach, describe, expect, it } from "vitest";
import { createApi, type ApiRequest } from "../src/api/api";
import { runIngestion } from "../src/ingest/ingest";
import { MemoryObjectStore, type ObjectStore } from "../src/shared/storage";
import { DAY, HOUR, NOW, fakeFetch, feature, feed, silentLogger } from "./fixtures";

const request = (path: string, query: Record<string, string> = {}, headers: Record<string, string> = {}): ApiRequest => ({
  method: "GET",
  path,
  query,
  headers,
});
const json = (res: { body: string; isBase64Encoded: boolean }) =>
  JSON.parse(res.isBase64Encoded ? gunzipSync(Buffer.from(res.body, "base64")).toString() : res.body);

async function seededStore() {
  const store = new MemoryObjectStore();
  const fetch = fakeFetch({
    "all_day.geojson": feed([feature("d1", { mag: 4.8 }), feature("d2", { mag: 1.2, time: NOW - 5 * HOUR })]),
    "all_month.geojson": feed([feature("w1", { mag: 3.1, time: NOW - 3 * DAY }), feature("m1", { mag: 6.1, time: NOW - 20 * DAY })]),
  });
  await runIngestion({ usgsBaseUrl: "https://usgs.test", windowDays: 30 }, { store, logger: silentLogger, now: () => NOW, fetchOptions: { fetch } });
  return store;
}

describe("API", () => {
  let clock = NOW;
  const config = { staleAfterSeconds: 900, cacheTtlMs: 30_000 };
  const api = (store: ObjectStore) => createApi(config, { store, logger: silentLogger, now: () => clock });

  beforeEach(() => {
    clock = NOW + 60_000;
  });

  it("filters earthquakes by range and minimum magnitude", async () => {
    const handle = api(await seededStore());
    expect(json(await handle(request("/earthquakes"))).features.map((f: { id: string }) => f.id)).toEqual(["d1", "d2"]);
    expect(json(await handle(request("/earthquakes", { range: "week" }))).features).toHaveLength(3);
    const month = json(await handle(request("/earthquakes", { range: "month", minMagnitude: "3" })));
    expect(month.features.map((f: { id: string }) => f.id)).toEqual(["d1", "w1", "m1"]);
    expect(month.metadata).toMatchObject({ count: 3, range: "month", minMagnitude: 3, generated: NOW, source: "georescue-api" });
  });

  it("supports since and limit, and validates parameters", async () => {
    const handle = api(await seededStore());
    const since = new Date(NOW - 4 * DAY).toISOString();
    expect(json(await handle(request("/earthquakes", { since, limit: "2" }))).features.map((f: { id: string }) => f.id)).toEqual(["d1", "d2"]);
    const invalid: Record<string, string>[] = [{ range: "year" }, { minMagnitude: "abc" }, { minMagnitude: "" }, { since: "yesterday" }, { limit: "0" }];
    for (const query of invalid) {
      const res = await handle(request("/earthquakes", query));
      expect(res.statusCode).toBe(400);
      expect(json(res).error).toBeTruthy();
    }
  });

  it("gzips large responses for clients that accept it", async () => {
    const handle = api(await seededStore());
    const res = await handle(request("/earthquakes", { range: "month" }, { "accept-encoding": "gzip, deflate, br" }));
    expect(res.isBase64Encoded).toBe(true);
    expect(res.headers["content-encoding"]).toBe("gzip");
    expect(json(res).features).toHaveLength(4);
  });

  it("reports health and metadata freshness", async () => {
    const handle = api(await seededStore());
    const ok = await handle(request("/health"));
    expect(ok.statusCode).toBe(200);
    expect(json(ok)).toMatchObject({ status: "ok", checks: { storage: "ok", ingestion: { stale: false, ageSeconds: 60 } } });

    const meta = json(await handle(request("/earthquakes/metadata")));
    expect(meta).toMatchObject({ windowDays: 30, stale: false, lastSuccessfulIngestion: { feedGenerated: NOW } });

    clock = NOW + 20 * 60_000;
    const stale = await handle(request("/health"));
    expect(stale.statusCode).toBe(503);
    expect(json(stale).status).toBe("stale");
  });

  it("returns 503/404 before the first ingestion and 404 for unknown routes", async () => {
    const handle = api(new MemoryObjectStore());
    expect((await handle(request("/earthquakes"))).statusCode).toBe(503);
    expect((await handle(request("/earthquakes/metadata"))).statusCode).toBe(404);
    expect(json(await handle(request("/health")))).toMatchObject({ status: "no-data" });
    expect((await handle(request("/nope"))).statusCode).toBe(404);
    expect((await handle({ ...request("/health"), method: "POST" })).statusCode).toBe(405);
  });

  it("hides storage errors behind a generic 500 / 503", async () => {
    const broken: ObjectStore = {
      get: async () => {
        throw new Error("AccessDenied: secret details");
      },
      getIfChanged: async () => "not-modified",
      put: async () => "",
    };
    const handle = api(broken);
    const res = await handle(request("/earthquakes"));
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain("secret");
    expect((await handle(request("/health"))).statusCode).toBe(503);
  });

  it("caches S3 reads and revalidates with ETags", async () => {
    const store = await seededStore();
    let gets = 0;
    let conditional = 0;
    const counting: ObjectStore = {
      get: (k) => (gets++, store.get(k)),
      getIfChanged: (k, e) => (conditional++, store.getIfChanged(k, e)),
      put: (k, b, o) => store.put(k, b, o),
    };
    const handle = api(counting);
    await handle(request("/earthquakes"));
    await handle(request("/earthquakes"));
    expect(gets).toBe(1);
    clock += 31_000;
    await handle(request("/earthquakes"));
    expect(conditional).toBe(1);
    expect(gets).toBe(1);
  });
});
