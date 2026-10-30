export type TimeRange = "day" | "week" | "month";

export type SeverityLevel = "minor" | "light" | "moderate" | "strong";

export interface Earthquake {
  id: string;
  magnitude: number;
  magnitudeType: string | null;
  place: string;
  time: number;
  updated: number;
  longitude: number;
  latitude: number;
  depthKm: number;
  url: string | null;
  tsunami: boolean;
  alert: string | null;
  felt: number | null;
  significance: number | null;
  status: string | null;
  severity: SeverityLevel;
}

export interface EarthquakeFeed {
  earthquakes: Earthquake[];
  /** Feed generation time reported by USGS (epoch ms). */
  generatedAt: number;
  /** Time the client finished fetching the feed (epoch ms). */
  fetchedAt: number;
  /** Number of raw features skipped because of missing magnitude or coordinates. */
  skipped: number;
  title: string;
}

export interface EarthquakeFilters {
  timeRange: TimeRange;
  minMagnitude: number;
  severities: SeverityLevel[];
}

/** Subset of the USGS GeoJSON summary format that GeoRescue reads. */
export interface UsgsFeature {
  type: "Feature";
  id: string;
  properties: {
    mag: number | null;
    place: string | null;
    time: number;
    updated: number;
    url?: string | null;
    felt?: number | null;
    alert?: string | null;
    status?: string | null;
    tsunami?: number | null;
    sig?: number | null;
    magType?: string | null;
    title?: string | null;
  };
  geometry: {
    type: "Point";
    coordinates: [number, number, number];
  } | null;
}

export interface UsgsFeedResponse {
  type: "FeatureCollection";
  metadata: {
    generated: number;
    title: string;
    count: number;
  };
  features: UsgsFeature[];
}
