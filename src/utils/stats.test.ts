import { describe, expect, it } from "vitest";
import type { Earthquake } from "../types/earthquake";
import { getSeverity } from "./severity";
import { computeStats, eventTimeline, filterEarthquakes, magnitudeHistogram } from "./stats";

function quake(id: string, magnitude: number, time = 0): Earthquake {
  return {
    id,
    magnitude,
    magnitudeType: "ml",
    place: "Somewhere, Region",
    time,
    updated: time,
    longitude: 0,
    latitude: 0,
    depthKm: 10,
    url: null,
    tsunami: false,
    alert: null,
    felt: null,
    significance: null,
    status: null,
    severity: getSeverity(magnitude),
  };
}

describe("severity", () => {
  it("maps magnitudes onto severity bands", () => {
    expect(getSeverity(-0.5)).toBe("minor");
    expect(getSeverity(2.5)).toBe("light");
    expect(getSeverity(4.5)).toBe("moderate");
    expect(getSeverity(7.1)).toBe("strong");
  });
});

describe("stats", () => {
  const quakes = [quake("a", 1.2), quake("b", 4.6), quake("c", 6.3), quake("d", 2.9)];

  it("derives totals from loaded data", () => {
    const stats = computeStats(quakes);
    expect(stats.total).toBe(4);
    expect(stats.significant).toBe(2);
    expect(stats.averageMagnitude).toBeCloseTo(3.75);
    expect(stats.strongest?.id).toBe("c");
  });

  it("returns empty stats for no data", () => {
    expect(computeStats([])).toMatchObject({ total: 0, averageMagnitude: null, strongest: null });
  });

  it("filters by minimum magnitude and severity", () => {
    const result = filterEarthquakes(quakes, { timeRange: "week", minMagnitude: 2.5, severities: ["light", "strong"] });
    expect(result.map((q) => q.id)).toEqual(["c", "d"]);
  });

  it("builds a magnitude histogram", () => {
    const bins = magnitudeHistogram(quakes);
    expect(bins.map((b) => b.label)).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(4);
  });

  it("buckets events into a timeline", () => {
    const now = Date.UTC(2026, 0, 2, 12);
    const buckets = eventTimeline([quake("x", 3, now - 1000), quake("y", 3, now - 5 * 3_600_000)], "day", now);
    expect(buckets).toHaveLength(24);
    expect(buckets.reduce((s, b) => s + b.count, 0)).toBe(2);
  });
});
