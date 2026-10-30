import { describe, expect, it } from "vitest";
import type { Facility } from "../types/facility";
import { analyzeGap, distanceKm, radiusCircle, rateProximity } from "./geo";

const center = { latitude: 0, longitude: 0 };

function facility(id: string, category: "hospital" | "emergency" | "clinic", latitude: number, kind?: Facility["kind"]): Facility {
  return {
    id,
    name: id,
    kind: kind ?? (category === "hospital" ? "hospital" : category === "clinic" ? "clinic" : "fire_station"),
    category,
    latitude,
    longitude: 0,
    hasEmergencyDept: null,
    osmUrl: "",
    details: {},
  };
}

// 1° of latitude ≈ 111.2 km
const deg = (km: number) => km / 111.195;

describe("geo utilities", () => {
  it("computes great-circle distances in kilometers", () => {
    expect(distanceKm(center, { latitude: 1, longitude: 0 })).toBeCloseTo(111.2, 0);
  });

  it("rates proximity by nearest hospital distance", () => {
    expect(rateProximity(5)).toBe("good");
    expect(rateProximity(20)).toBe("moderate");
    expect(rateProximity(40)).toBe("limited");
    expect(rateProximity(null)).toBe("critical");
  });

  it("counts facilities inside each radius and finds the nearest hospital", () => {
    const result = analyzeGap(center, [
      facility("h-far", "hospital", deg(40)),
      facility("h-near", "hospital", deg(8)),
      facility("f-mid", "emergency", deg(20)),
      facility("h-out", "hospital", deg(80)),
    ]);
    expect(result.radii.map(({ radiusKm, hospitals, clinics, emergency }) => ({ radiusKm, hospitals, clinics, emergency }))).toEqual([
      { radiusKm: 10, hospitals: 1, clinics: 0, emergency: 0 },
      { radiusKm: 25, hospitals: 1, clinics: 0, emergency: 1 },
      { radiusKm: 50, hospitals: 2, clinics: 0, emergency: 1 },
    ]);
    expect(result.radii[2].byKind).toMatchObject({ hospital: 2, fire_station: 1, police: 0 });
    expect(result.nearestFireStation?.id).toBe("f-mid");
    expect(result.nearestHospital?.id).toBe("h-near");
    expect(result.nearestHospital?.distanceKm).toBeCloseTo(8, 1);
    expect(result.nearestEmergency?.id).toBe("f-mid");
    expect(result.rating).toBe("good");
    expect(result.facilities.map((f) => f.id)).toEqual(["h-near", "f-mid", "h-far"]);
  });

  it("uses configurable radii for counts and the coverage class", () => {
    const facilities = [
      facility("h", "hospital", deg(18)),
      facility("c", "clinic", deg(3)),
      facility("p", "emergency", deg(6), "police"),
      facility("a", "emergency", deg(4), "ambulance_station"),
    ];
    const urban = analyzeGap(center, facilities, [5, 10, 20]);
    expect(urban.radii.map((r) => r.radiusKm)).toEqual([5, 10, 20]);
    expect(urban.radii[0]).toMatchObject({ clinics: 1, emergency: 1, hospitals: 0 });
    expect(urban.radii[1].emergency).toBe(2);
    expect(urban.rating).toBe("limited");
    expect(urban.nearestEmergency?.id).toBe("a");
    expect(analyzeGap(center, facilities, [20, 35, 50]).rating).toBe("good");
    expect(rateProximity(30, [5, 10, 20])).toBe("critical");
  });

  it("flags a critical gap when no hospital is mapped within 50 km", () => {
    const result = analyzeGap(center, [facility("f", "emergency", deg(5))]);
    expect(result.nearestHospital).toBeNull();
    expect(result.rating).toBe("critical");
  });

  it("creates closed radius polygons", () => {
    const ring = radiusCircle(center, 10).geometry.coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });
});
