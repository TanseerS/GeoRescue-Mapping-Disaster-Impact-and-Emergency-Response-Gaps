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

/** Where a feed was loaded from: the GeoRescue AWS API or the USGS feed directly. */
export type DataSource = "aws-api" | "usgs-direct" | "usgs-fallback";

export interface EarthquakeFeed {
  source: DataSource;
  /** Why the app fell back to USGS (only for "usgs-fallback"). */
  fallbackReason: string | null;
  /** When the AWS pipeline last ingested this data (epoch ms, AWS API only). */
  ingestedAt: number | null;
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
    /** Present on responses from the GeoRescue AWS API. */
    ingestedAt?: number;
    source?: string;
  };
  features: UsgsFeature[];
}
