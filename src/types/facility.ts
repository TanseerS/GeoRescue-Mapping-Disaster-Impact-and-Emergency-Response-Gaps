export type FacilityCategory = "hospital" | "emergency";

export type FacilityKind = "hospital" | "fire_station" | "police" | "ambulance_station";

export interface Facility {
  /** OSM-qualified id, e.g. "node/123". */
  id: string;
  name: string;
  kind: FacilityKind;
  category: FacilityCategory;
  latitude: number;
  longitude: number;
  hasEmergencyDept: boolean | null;
  osmUrl: string;
}

export interface FacilityWithDistance extends Facility {
  distanceKm: number;
}

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export type FacilityQuery =
  | { type: "radius"; latitude: number; longitude: number; radiusKm: number }
  | { type: "bbox"; bbox: BoundingBox };

export type FacilityStatus = "idle" | "loading" | "success" | "error";

export interface FacilityResult {
  key: string;
  status: FacilityStatus;
  facilities: Facility[];
  error: string | null;
  fetchedAt: number | null;
  /** When the in-flight request started (epoch ms). */
  requestedAt: number | null;
}

export interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface OverpassResponse {
  elements: OverpassElement[];
  remark?: string;
}
