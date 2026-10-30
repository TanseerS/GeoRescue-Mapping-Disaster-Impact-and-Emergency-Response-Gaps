import circle from "@turf/circle";
import distance from "@turf/distance";
import { point } from "@turf/helpers";
import type { Feature, Polygon } from "geojson";
import { ANALYSIS_RADII_KM } from "../config/constants";
import type { GapAnalysis, ProximityRating } from "../types/analysis";
import type { Facility, FacilityKind, FacilityWithDistance } from "../types/facility";

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

/**
 * Coverage class from the straight-line distance to the nearest mapped hospital:
 * within the first radius = good, second = moderate, third = limited, beyond = critical.
 */
export function rateProximity(nearestHospitalKm: number | null, radii: readonly number[] = ANALYSIS_RADII_KM): ProximityRating {
  const [inner, middle, outer] = radii;
  if (nearestHospitalKm === null || nearestHospitalKm > outer) return "critical";
  if (nearestHospitalKm <= inner) return "good";
  if (nearestHospitalKm <= middle) return "moderate";
  return "limited";
}

const KINDS: FacilityKind[] = ["hospital", "clinic", "fire_station", "ambulance_station", "police"];

function emptyByKind(): Record<FacilityKind, number> {
  return { hospital: 0, clinic: 0, fire_station: 0, ambulance_station: 0, police: 0 };
}

/**
 * Proximity-based response gap estimate around an epicenter. Counts mapped facilities of each
 * type inside each analysis radius and finds the nearest mapped facility of each type.
 */
export function analyzeGap(
  center: LngLat,
  facilities: Facility[],
  radii: readonly number[] = ANALYSIS_RADII_KM,
): GapAnalysis {
  const maxRadius = Math.max(...radii);
  const sorted = withDistances(center, facilities, maxRadius);
  const nearest = Object.fromEntries(KINDS.map((k) => [k, sorted.find((f) => f.kind === k) ?? null])) as GapAnalysis["nearest"];

  return {
    radii: radii.map((radiusKm) => {
      const byKind = emptyByKind();
      for (const f of sorted) {
        if (f.distanceKm > radiusKm) break;
        byKind[f.kind] += 1;
      }
      return {
        radiusKm,
        hospitals: byKind.hospital,
        clinics: byKind.clinic,
        emergency: byKind.fire_station + byKind.ambulance_station + byKind.police,
        byKind,
      };
    }),
    nearest,
    nearestHospital: nearest.hospital,
    nearestFireStation: nearest.fire_station,
    nearestEmergency: sorted.find((f) => f.category === "emergency") ?? null,
    rating: rateProximity(nearest.hospital ? nearest.hospital.distanceKm : null, radii),
    facilities: sorted,
  };
}
