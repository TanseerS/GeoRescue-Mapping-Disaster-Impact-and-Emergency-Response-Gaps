import { describe, expect, it } from "vitest";
import { recordFailure, runIngestion, type IngestionMetadata } from "../src/ingest/ingest";
import type { EarthquakeCollection } from "../src/shared/geojson";
import { KEYS } from "../src/shared/keys";
import { MemoryObjectStore, PreconditionFailedError, type PutOptions } from "../src/shared/storage";
import { DAY, HOUR, NOW, fakeFetch, feature, feed, silentLogger } from "./fixtures";

const config = { usgsBaseUrl: "https://usgs.test/summary", windowDays: 30 };
const noSleep = async () => undefined;

function setup(dayFeed: () => unknown, monthFeed: unknown = feed([feature("month-1", { time: NOW - 10 * DAY })])) {
  const store = new MemoryObjectStore();
  const fetch = fakeFetch({ "all_day.geojson": dayFeed, "all_month.geojson": monthFeed });
  let clock = NOW;
  const deps = { store, logger: silentLogger, now: () => (clock += 10), fetchOptions: { fetch, sleep: noSleep } };
  const read = <T>(key: string) => JSON.parse(store.objects.get(key)!.body) as T;
  return { store, fetch, deps, read };
}

describe("runIngestion", () => {
  it("seeds the window from all_month on the first run and writes every artifact", async () => {
    const { deps, read, store, fetch } = setup(() => feed([feature("day-1"), feature("day-2", { time: NOW - 2 * HOUR })]));
    const result = await runIngestion(config, deps);

    expect(result.status).toBe("success");
    expect(fetch.calls.some((u) => u.endsWith("all_month.geojson"))).toBe(true);
    const window = read<EarthquakeCollection>(KEYS.window);
    expect(window.features.map((f) => f.id)).toEqual(["day-1", "day-2", "month-1"]);
    expect(read<EarthquakeCollection>(KEYS.latest).features).toHaveLength(2);
    expect(store.objects.has("earthquakes/history/2026/10/30/12.json")).toBe(true);

    const meta = read<IngestionMetadata>(KEYS.metadata);
    expect(meta.lastSuccessfulIngestion).toMatchObject({ feedGenerated: NOW, feedCount: 2, windowCount: 3, seeded: true, historyWritten: true });
    expect(meta.lastAttempt.status).toBe("success");
  });

  it("skips a feed generation that was already ingested (duplicate runs)", async () => {
    const { deps, store } = setup(() => feed([feature("day-1")]));
    await runIngestion(config, deps);
    const before = new Map(store.objects);
    const second = await runIngestion(config, deps);
    expect(second.status).toBe("skipped");
    expect(store.objects).toEqual(before);
  });

  it("merges newer feeds and never overwrites an hourly snapshot", async () => {
    let generated = NOW;
    const { deps, read, store } = setup(() => feed([feature("day-1"), feature(`new-${generated}`, { time: generated - 60_000 })], generated));
    await runIngestion(config, deps);
    const firstSnapshot = store.objects.get("earthquakes/history/2026/10/30/12.json")!.body;

    generated = NOW + 5 * 60_000;
    const result = await runIngestion(config, deps);
    expect(result.status === "success" && result.record).toMatchObject({ seeded: false, historyWritten: false, added: 1 });
    expect(store.objects.get("earthquakes/history/2026/10/30/12.json")!.body).toBe(firstSnapshot);
    expect(read<EarthquakeCollection>(KEYS.window).features.map((f) => f.id)).toContain(`new-${generated}`);

    generated = NOW + HOUR;
    await runIngestion(config, deps);
    expect(store.objects.has("earthquakes/history/2026/10/30/13.json")).toBe(true);
  });

  it("re-merges when the window is modified concurrently", async () => {
    const { deps, store, read } = setup(() => feed([feature("day-1")]));
    await runIngestion(config, { ...deps, now: () => NOW - 5 * 60_000 });
    // Simulate a concurrent writer: the first conditional window write fails once.
    const originalPut = store.put.bind(store);
    let conflicts = 0;
    store.put = async (key: string, body: string, options?: PutOptions) => {
      if (key === KEYS.window && conflicts === 0) {
        conflicts += 1;
        await originalPut(key, store.objects.get(key)!.body); // bumps the ETag
        throw new PreconditionFailedError(key);
      }
      return originalPut(key, body, options);
    };
    const fetchNewer = { ...deps.fetchOptions, fetch: fakeFetch({ "all_day.geojson": feed([feature("day-1"), feature("day-2")], NOW + 60_000) }) };
    const result = await runIngestion(config, { ...deps, fetchOptions: fetchNewer });
    expect(result.status).toBe("success");
    expect(conflicts).toBe(1);
    expect(read<EarthquakeCollection>(KEYS.window).features.map((f) => f.id).sort()).toEqual(["day-1", "day-2", "month-1"]);
  });

  it("fails without touching stored data when USGS returns an invalid feed", async () => {
    const { deps, store } = setup(() => ({ type: "FeatureCollection", features: "nope" }));
    await expect(runIngestion(config, deps)).rejects.toThrow("no features array");
    expect(store.objects.size).toBe(0);
  });
});

describe("recordFailure", () => {
  it("keeps the last successful ingestion when recording a failure", async () => {
    const { deps, store, read } = setup(() => feed([feature("day-1")]));
    await runIngestion(config, deps);
    await recordFailure(store, new Error("USGS responded with HTTP 503"), NOW, NOW + 1000, 30, silentLogger);
    const meta = read<IngestionMetadata>(KEYS.metadata);
    expect(meta.lastSuccessfulIngestion?.feedGenerated).toBe(NOW);
    expect(meta.lastAttempt).toMatchObject({ status: "failure", error: "USGS responded with HTTP 503" });
  });
});
