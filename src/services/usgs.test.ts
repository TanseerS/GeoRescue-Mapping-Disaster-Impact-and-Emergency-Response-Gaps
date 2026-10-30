import { describe, expect, it } from "vitest";
import type { UsgsFeedResponse } from "../types/earthquake";
import { feedUrl, normalizeFeed } from "./usgs";

const feed: UsgsFeedResponse = {
  type: "FeatureCollection",
  metadata: { generated: 1_700_000_000_000, title: "USGS All Earthquakes, Past Week", count: 3 },
  features: [
    {
      type: "Feature",
      id: "us1",
      properties: { mag: 5.2, place: "10 km S of Town, Chile", time: 1000, updated: 1100, tsunami: 1, magType: "mww" },
      geometry: { type: "Point", coordinates: [-70.5, -33.4, 35.2] },
    },
    {
      type: "Feature",
      id: "ak2",
      properties: { mag: null, place: "Alaska", time: 2000, updated: 2000 },
      geometry: { type: "Point", coordinates: [-150, 61, 10] },
    },
    {
      type: "Feature",
      id: "ci3",
      properties: { mag: 1.1, place: null, title: "M 1.1 - Somewhere", time: 3000, updated: 3000 },
      geometry: { type: "Point", coordinates: [-117, 34, 4] },
    },
  ],
};

describe("usgs service", () => {
  it("builds feed URLs for every time range", () => {
    expect(feedUrl("day")).toMatch(/all_day\.geojson$/);
    expect(feedUrl("week")).toMatch(/all_week\.geojson$/);
    expect(feedUrl("month")).toMatch(/all_month\.geojson$/);
  });

  it("normalizes features, skips records without magnitude and sorts newest first", () => {
    const result = normalizeFeed(feed, 5000);
    expect(result.skipped).toBe(1);
    expect(result.earthquakes.map((q) => q.id)).toEqual(["ci3", "us1"]);
    const chile = result.earthquakes[1];
    expect(chile).toMatchObject({
      magnitude: 5.2,
      latitude: -33.4,
      longitude: -70.5,
      depthKm: 35.2,
      tsunami: true,
      severity: "moderate",
    });
    expect(result.earthquakes[0].place).toBe("M 1.1 - Somewhere");
    expect(result.generatedAt).toBe(1_700_000_000_000);
  });
});
