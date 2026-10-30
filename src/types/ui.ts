export type ViewId = "overview" | "map" | "facilities" | "analysis" | "about";

export interface LayerVisibility {
  earthquakes: boolean;
  hospitals: boolean;
  emergency: boolean;
}
