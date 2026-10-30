/** Analysis groups: hospitals, clinics, and emergency services (fire, ambulance, police). */
export type FacilityCategory = "hospital" | "clinic" | "emergency";

export type FacilityKind = "hospital" | "clinic" | "fire_station" | "ambulance_station" | "police";

/** Selected OpenStreetMap tags, kept verbatim when present. Nothing is inferred. */
export interface FacilityDetails {
  operator?: string;
  phone?: string;
  website?: string;
  address?: string;
  beds?: string;
  openingHours?: string;
  speciality?: string;
}

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
  details: FacilityDetails;
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
