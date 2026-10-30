import { describe, expect, it } from "vitest";
import { fetchUsgsFeed } from "../src/ingest/usgsClient";
import { fakeFetch, feature, feed, silentLogger } from "./fixtures";

const noSleep = async () => undefined;

describe("fetchUsgsFeed", () => {
  it("retries transient failures", async () => {
    let calls = 0;
    const fetch = fakeFetch({ "all_day.geojson": () => (++calls < 3 ? 503 : feed([feature("a")])) });
    const result = await fetchUsgsFeed("https://x/all_day.geojson", { fetch, sleep: noSleep, logger: silentLogger });
    expect(calls).toBe(3);
    expect(result.rawFeatures).toHaveLength(1);
  });

  it("retries network errors and gives up after the configured attempts", async () => {
    const fetch = fakeFetch({ "all_day.geojson": () => new TypeError("fetch failed") });
    await expect(fetchUsgsFeed("https://x/all_day.geojson", { fetch, sleep: noSleep, attempts: 2 })).rejects.toThrow("fetch failed");
    expect(fetch.calls).toHaveLength(2);
  });

  it("does not retry client errors or invalid payloads", async () => {
    const notFound = fakeFetch({ "all_day.geojson": 403 });
    await expect(fetchUsgsFeed("https://x/all_day.geojson", { fetch: notFound, sleep: noSleep })).rejects.toThrow("HTTP 403");
    expect(notFound.calls).toHaveLength(1);

    const invalid = fakeFetch({ "all_day.geojson": { type: "nope" } });
    await expect(fetchUsgsFeed("https://x/all_day.geojson", { fetch: invalid, sleep: noSleep })).rejects.toThrow("Unexpected feed type");
    expect(invalid.calls).toHaveLength(1);
  });
});
