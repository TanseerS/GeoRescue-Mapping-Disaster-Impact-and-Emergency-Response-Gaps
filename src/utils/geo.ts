import circle from "@turf/circle";
import distance from "@turf/distance";
import { point } from "@turf/helpers";
import type { Feature, Polygon } from "geojson";
import { ANALYSIS_RADII_KM } from "../config/constants";
import type { GapAnalysis, ProximityRating } from "../types/analysis";
import type { Facility, FacilityWithDistance } from "../types/facility";

export interface LngLat {
  longitude: number;
  latitude: number;
}

export function distanceKm(from: LngLat, to: LngLat): number {
  return distance(point([from.longitude, from.latitude]), point([to.longitude, to.latitude]), {
    units: "kilometers",
  });
}

export function radiusCircle(center: LngLat, radiusKm: number): Feature<Polygon> {
  return circle([center.longitude, center.latitude], radiusKm, { steps: 96, units: "kilometers" });
}

export function withDistances(center: LngLat, facilities: Facility[], maxKm = Infinity): FacilityWithDistance[] {
  return facilities
    .map((f) => ({ ...f, distanceKm: distanceKm(center, f) }))
    .filter((f) => f.distanceKm <= maxKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export function rateProximity(nearestHospitalKm: number | null): ProximityRating {
  if (nearestHospitalKm === null || nearestHospitalKm > 50) return "critical";
  if (nearestHospitalKm <= 10) return "good";
  if (nearestHospitalKm <= 25) return "moderate";
  return "limited";
}

/**
 * Proximity-based response gap estimate around an epicenter. Counts mapped facilities
 * inside each analysis radius and finds the nearest mapped hospital / emergency facility.
 */
export function analyzeGap(
  center: LngLat,
  facilities: Facility[],
  radii: readonly number[] = ANALYSIS_RADII_KM,
): GapAnalysis {
  const maxRadius = Math.max(...radii);
  const sorted = withDistances(center, facilities, maxRadius);
  const nearestHospital = sorted.find((f) => f.category === "hospital") ?? null;
  const nearestEmergency = sorted.find((f) => f.category === "emergency") ?? null;

  return {
    radii: radii.map((radiusKm) => {
      const inside = sorted.filter((f) => f.distanceKm <= radiusKm);
      return {
        radiusKm,
        hospitals: inside.filter((f) => f.category === "hospital").length,
        emergency: inside.filter((f) => f.category === "emergency").length,
      };
    }),
    nearestHospital,
    nearestEmergency,
    rating: rateProximity(nearestHospital ? nearestHospital.distanceKm : null),
    facilities: sorted,
  };
}
