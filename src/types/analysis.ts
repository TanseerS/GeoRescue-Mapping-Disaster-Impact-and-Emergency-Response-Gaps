import type { FacilityKind, FacilityWithDistance } from "./facility";

/** Coverage classes derived from the distance to the nearest mapped hospital versus the analysis radii. */
export type ProximityRating = "good" | "moderate" | "limited" | "critical";

export interface RadiusCount {
  radiusKm: number;
  hospitals: number;
  clinics: number;
  /** Emergency services: fire, ambulance and police stations. */
  emergency: number;
  byKind: Record<FacilityKind, number>;
}

export interface GapAnalysis {
  radii: RadiusCount[];
  nearest: Record<FacilityKind, FacilityWithDistance | null>;
  nearestHospital: FacilityWithDistance | null;
  nearestFireStation: FacilityWithDistance | null;
  /** Nearest fire, ambulance or police station. */
  nearestEmergency: FacilityWithDistance | null;
  rating: ProximityRating;
  /** All facilities within the largest radius, sorted by distance. */
  facilities: FacilityWithDistance[];
}
