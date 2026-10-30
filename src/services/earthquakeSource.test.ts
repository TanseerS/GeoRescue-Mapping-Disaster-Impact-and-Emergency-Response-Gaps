import { afterEach, describe, expect, it, vi } from "vitest";
import { loadEarthquakes } from "./earthquakeSource";

const collection = (ids: string[], extra: Record<string, unknown> = {}) => ({
  type: "FeatureCollection",
  metadata: { generated: 1_000, title: "feed", count: ids.length, ...extra },
  features: ids.map((id) => ({
    type: "Feature",
    id,
    properties: { mag: 3.1, place: id, time: 500, updated: 500 },
    geometry: { type: "Point", coordinates: [10, 20, 5] },
  })),
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("loadEarthquakes", () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  afterEach(() => vi.unstubAllGlobals());

  it("reads USGS directly when no API is configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(collection(["usgs-1"])));
    vi.stubGlobal("fetch", fetchMock);
    const feed = await loadEarthquakes("day", undefined, { apiBaseUrl: "", fallbackToUsgs: true });
    expect(fetchMock.mock.calls[0][0]).toMatch(/earthquake\.usgs\.gov.*all_day\.geojson$/);
    expect(feed).toMatchObject({ source: "usgs-direct", fallbackReason: null });
  });

  it("uses the AWS API when configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(collection(["api-1", "api-2"], { ingestedAt: 900, source: "georescue-api" })));
    vi.stubGlobal("fetch", fetchMock);
    const feed = await loadEarthquakes("week", undefined, { apiBaseUrl: "https://api.example.com", fallbackToUsgs: true });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.com/earthquakes?range=week");
    expect(feed).toMatchObject({ source: "aws-api", ingestedAt: 900 });
    expect(feed.earthquakes.map((q) => q.id)).toEqual(["api-1", "api-2"]);
  });

  it("falls back to USGS when the API fails and records why", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ error: "Earthquake data has not been ingested yet." }, 503))
      .mockResolvedValueOnce(json(collection(["usgs-1"])));
    vi.stubGlobal("fetch", fetchMock);
    const feed = await loadEarthquakes("month", undefined, { apiBaseUrl: "https://api.example.com", fallbackToUsgs: true });
    expect(fetchMock.mock.calls[1][0]).toMatch(/all_month\.geojson$/);
    expect(feed.source).toBe("usgs-fallback");
    expect(feed.fallbackReason).toContain("HTTP 503: Earthquake data has not been ingested yet.");
  });

  it("surfaces the API error when fallback is disabled", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(
      loadEarthquakes("day", undefined, { apiBaseUrl: "https://api.example.com", fallbackToUsgs: false }),
    ).rejects.toThrow("GeoRescue API is unreachable");
  });
});
