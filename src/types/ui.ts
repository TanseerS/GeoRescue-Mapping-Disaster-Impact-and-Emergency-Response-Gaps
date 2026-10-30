import type { FacilityKind } from "./facility";

export type ViewId = "overview" | "map" | "facilities" | "analysis" | "about";

export type MapDisplayMode = "markers" | "clusters" | "heatmap";

export type EarthquakeColorMode = "severity" | "depth";

export interface LayerVisibility {
  earthquakes: boolean;
  facilities: Record<FacilityKind, boolean>;
}

export interface MapSettings {
  displayMode: MapDisplayMode;
  colorBy: EarthquakeColorMode;
}
