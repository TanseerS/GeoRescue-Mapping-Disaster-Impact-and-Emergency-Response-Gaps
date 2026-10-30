import type { FacilityWithDistance } from "./facility";

export type ProximityRating = "good" | "moderate" | "limited" | "critical";

export interface RadiusCount {
  radiusKm: number;
  hospitals: number;
  emergency: number;
}

export interface GapAnalysis {
  radii: RadiusCount[];
  nearestHospital: FacilityWithDistance | null;
  nearestEmergency: FacilityWithDistance | null;
  rating: ProximityRating;
  /** All facilities within the search radius, sorted by distance. */
  facilities: FacilityWithDistance[];
}
