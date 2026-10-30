import { describe, expect, it } from "vitest";
import type { Earthquake } from "../types/earthquake";
import type { Facility } from "../types/facility";
import { analyzeGap } from "./geo";
import { buildBrief, coverageClasses, formatPopulation } from "./intelligence";

const quake: Earthquake = {
  id: "us1",
  magnitude: 6.2,
  magnitudeType: "mww",
  place: "12 km NE of Town, Region",
  time: Date.UTC(2026, 9, 30, 10),
  updated: Date.UTC(2026, 9, 30, 10),
  longitude: 0,
  latitude: 0,
  depthKm: 12,
  url: null,
  tsunami: true,
  alert: "yellow",
  felt: null,
  significance: null,
  status: null,
  severity: "strong",
};

const fac = (id: string, kind: Facility["kind"], km: number): Facility => ({
  id,
  name: id,
  kind,
  category: kind === "hospital" || kind === "clinic" ? kind : "emergency",
  latitude: km / 111.195,
  longitude: 0,
  hasEmergencyDept: null,
  osmUrl: "",
  details: {},
});

describe("formatPopulation", () => {
  it("rounds to three significant figures", () => {
    expect(formatPopulation(307069.5)).toBe((307000).toLocaleString());
    expect(formatPopulation(35016706.21)).toBe("35 M");
    expect(formatPopulation(642)).toBe("642");
    expect(formatPopulation(0)).toBe("0");
  });
});

describe("buildBrief", () => {
  const radii = [10, 25, 50] as const;

  it("summarizes only calculated values", () => {
    const analysis = analyzeGap(quake, [fac("General Hospital", "hospital", 14), fac("Station 3", "fire_station", 6), fac("Clinic A", "clinic", 2)], radii);
    const brief = buildBrief({
      quake,
      analysis,
      radii,
      population: { dataset: "WorldPop", year: 2020, resolution: "~100 m", license: "CC BY 4.0", sourceUrl: "", results: [{ radiusKm: 10, population: 120400 }] },
      facilitiesUnavailable: false,
      now: quake.time + 3 * 3_600_000,
    });
    const text = brief.plainText;
    expect(brief.headline).toBe("M6.2 strong+ earthquake · 12 km NE of Town, Region");
    expect(text).toContain("1 hospital, 1 clinic and 1 emergency service");
    expect(text).toContain("General Hospital, 14 km");
    expect(text).toContain("Station 3, 6.0 km");
    expect(text).toContain("tsunami flag");
    expect(text).toContain("≈ 120,000 within 10 km");
    expect(text).toContain("Residents, not casualties");
    expect(brief.coverage).toEqual(coverageClasses(radii).moderate);
    expect(brief.limitations.length).toBe(4);
  });

  it("reports when nothing is mapped or facility data failed", () => {
    const none = buildBrief({ quake, analysis: analyzeGap(quake, [], radii), radii, population: null, facilitiesUnavailable: false });
    expect(none.plainText).toContain("No hospitals, clinics or emergency services are mapped");
    expect(none.coverage?.rating).toBe("critical");
    const failed = buildBrief({ quake, analysis: null, radii, population: null, facilitiesUnavailable: true });
    expect(failed.plainText).toContain("could not be loaded");
    expect(failed.coverage).toBeNull();
  });
});
