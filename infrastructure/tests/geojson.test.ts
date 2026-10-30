import { describe, expect, it } from "vitest";
import { FeedValidationError, mergeWindow, normalizeFeatures, validateFeed, type EarthquakeFeature } from "../src/shared/geojson";
import { historyKey } from "../src/shared/keys";
import { DAY, HOUR, NOW, feature, feed } from "./fixtures";

const asFeatures = (raw: unknown[]) => normalizeFeatures(raw).features;

describe("validateFeed", () => {
  it("accepts a USGS FeatureCollection", () => {
    const result = validateFeed(feed([feature("a")]));
    expect(result.generated).toBe(NOW);
    expect(result.rawFeatures).toHaveLength(1);
  });

  it.each([
    [null, /not a JSON object/],
    [{ type: "Feature" }, /Unexpected feed type/],
    [{ type: "FeatureCollection", metadata: { generated: 1 } }, /no features array/],
    [{ type: "FeatureCollection", features: [] }, /generated is missing/],
  ])("rejects invalid payload %#", (payload, message) => {
    expect(() => validateFeed(payload)).toThrow(FeedValidationError);
    expect(() => validateFeed(payload)).toThrow(message);
  });
});

describe("normalizeFeatures", () => {
  it("preserves original properties and coordinates", () => {
    const raw = feature("a", { mag: 4.2 });
    const [f] = asFeatures([raw]);
    expect(f.properties).toMatchObject(raw.properties);
    expect(f.geometry.coordinates).toEqual([-120.5, 36.1, 8.2]);
  });

  it("rejects malformed records, de-duplicates by id and sorts newest first", () => {
    const result = normalizeFeatures([
      feature("old", { time: NOW - 5 * HOUR }),
      feature("dup", { time: NOW - 2 * HOUR, updated: NOW - 2 * HOUR }),
      feature("dup", { time: NOW - 2 * HOUR, updated: NOW - HOUR, mag: 3.3 }),
      feature("bad-lat", { lat: 123 }),
      { ...feature("no-geom"), geometry: null },
      { ...feature(""), id: "" },
      feature("null-mag", { mag: null, time: NOW - 10 * 60_000 }),
    ]);
    expect(result.rejected).toBe(3);
    expect(result.duplicates).toBe(1);
    expect(result.features.map((f) => f.id)).toEqual(["null-mag", "dup", "old"]);
    expect(result.features[1].properties.mag).toBe(3.3);
    expect(result.features[0].properties.mag).toBeNull();
  });
});

describe("mergeWindow", () => {
  const options = { feedGenerated: NOW, feedCoverageMs: DAY, windowMs: 30 * DAY };

  it("adds, updates, expires and drops events deleted upstream", () => {
    const existing: EarthquakeFeature[] = asFeatures([
      feature("kept-old", { time: NOW - 10 * DAY }),
      feature("expired", { time: NOW - 31 * DAY }),
      feature("deleted-upstream", { time: NOW - 3 * HOUR }),
      feature("revised", { time: NOW - 2 * HOUR, updated: NOW - 2 * HOUR, mag: 2.0 }),
    ]);
    const incoming = asFeatures([
      feature("revised", { time: NOW - 2 * HOUR, updated: NOW - HOUR, mag: 2.4 }),
      feature("new", { time: NOW - 30 * 60_000 }),
    ]);
    const result = mergeWindow(existing, incoming, options);
    expect(result.features.map((f) => f.id)).toEqual(["new", "revised", "kept-old"]);
    expect(result).toMatchObject({ added: 1, updated: 1, removed: 1, expired: 1 });
    expect(result.features[1].properties.mag).toBe(2.4);
  });

  it("is idempotent", () => {
    const incoming = asFeatures([feature("a"), feature("b", { time: NOW - 3 * HOUR })]);
    const once = mergeWindow([], incoming, options);
    const twice = mergeWindow(once.features, incoming, options);
    expect(twice.features).toEqual(once.features);
    expect(twice).toMatchObject({ added: 0, updated: 0, removed: 0, expired: 0 });
  });

  it("keeps events near the edge of the feed coverage", () => {
    const existing = asFeatures([feature("edge", { time: NOW - DAY + 10 * 60_000 })]);
    expect(mergeWindow(existing, [], options).features).toHaveLength(1);
  });
});

describe("historyKey", () => {
  it("builds hourly UTC snapshot keys", () => {
    expect(historyKey(Date.UTC(2026, 0, 5, 7, 59))).toBe("earthquakes/history/2026/01/05/07.json");
  });
});
