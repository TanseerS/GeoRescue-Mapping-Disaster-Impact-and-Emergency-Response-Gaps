import { describe, expect, it } from "vitest";
import type { Earthquake } from "../types/earthquake";
import { getSeverity } from "./severity";
import { computeStats, depthClass, depthHistogram, eventTimeline, facilityDistribution, filterEarthquakes, magnitudeCategories, magnitudeHistogram, regionBounds, regionOf } from "./stats";

function quake(id: string, magnitude: number, time = 0, depthKm = 10, place = "Somewhere, Region", lon = 0, lat = 0): Earthquake {
  return {
    id,
    magnitude,
    magnitudeType: "ml",
    place,
    time,
    updated: time,
    longitude: lon,
    latitude: lat,
    depthKm,
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

describe("depth and category analytics", () => {
  it("classifies focal depth", () => {
    expect(depthClass(5).id).toBe("shallow");
    expect(depthClass(70).id).toBe("intermediate");
    expect(depthClass(450).id).toBe("deep");
  });

  it("bins events by depth", () => {
    const bins = depthHistogram([quake("a", 2, 0, 3), quake("b", 2, 0, 45), quake("c", 2, 0, 600), quake("d", 2, 0, 800), quake("e", 2, 0, -1)]);
    expect(bins.map((b) => b.count)).toEqual([2, 0, 1, 0, 0, 2]);
    expect(bins[5]).toMatchObject({ label: "300+", depthClass: "deep" });
  });

  it("counts events per magnitude category", () => {
    const cats = magnitudeCategories([quake("a", 1), quake("b", 3), quake("c", 3.1), quake("d", 6.5)]);
    expect(cats.map((c) => [c.id, c.count])).toEqual([["minor", 1], ["light", 2], ["moderate", 0], ["strong", 1]]);
  });

  it("finds region bounds and expands US state abbreviations", () => {
    expect(regionOf("10 km NW of Ridgecrest, CA")).toBe("California");
    const events = [quake("a", 2, 0, 5, "5 km N of A, Alaska", -150, 60), quake("b", 2, 0, 5, "9 km S of B, Alaska", -140, 62), quake("c", 2, 0, 5, "X, Chile", -70, -30)];
    expect(regionBounds(events, "Alaska")).toEqual([[-150, 60], [-140, 62]]);
    expect(regionBounds(events, "Nowhere")).toBeNull();
    const aleutians = [quake("w", 2, 0, 5, "A, Alaska", 178, 51), quake("e", 2, 0, 5, "B, Alaska", -175, 52)];
    expect(regionBounds(aleutians, "Alaska")).toEqual([[178, 51], [185, 52]]);
  });

  it("counts mapped facilities by type", () => {
    const f = (kind: "hospital" | "clinic" | "police") => ({ id: kind + Math.random(), kind } as Parameters<typeof facilityDistribution>[0][number]);
    const dist = facilityDistribution([f("hospital"), f("clinic"), f("clinic"), f("police")]);
    expect(dist.find((d) => d.kind === "clinic")?.count).toBe(2);
    expect(dist.find((d) => d.kind === "fire_station")?.count).toBe(0);
  });
});
