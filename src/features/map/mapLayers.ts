import type { ExpressionSpecification, LayerSpecification, Map as MapLibreMap } from "maplibre-gl";
import { FACILITY_COLORS, SEVERITIES } from "../../config/constants";
import type { LayerVisibility } from "../../types/ui";
import { EMPTY_FC } from "./mapData";
import { registerMapIcons } from "./mapIcons";

export const SOURCES = {
  earthquakes: "gr-earthquakes",
  selected: "gr-selected",
  rings: "gr-rings",
  facilities: "gr-facilities",
  nearest: "gr-nearest",
} as const;

export const LAYERS = {
  ringsFill: "gr-rings-fill",
  ringsLine: "gr-rings-line",
  nearest: "gr-nearest-line",
  clusters: "gr-eq-clusters",
  clusterCount: "gr-eq-cluster-count",
  glow: "gr-eq-glow",
  points: "gr-eq-points",
  selectedHalo: "gr-selected-halo",
  selectedPoint: "gr-selected-point",
  facilities: "gr-facilities",
} as const;

/** Severity color by magnitude, matching the SEVERITIES thresholds. */
function severityColorBy(input: ExpressionSpecification): ExpressionSpecification {
  const stops: (string | number)[] = [];
  SEVERITIES.slice(1).forEach((s) => stops.push(s.min, s.color));
  return ["step", input, SEVERITIES[0].color, ...stops] as unknown as ExpressionSpecification;
}

const magnitudeRadius: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["get", "mag"],
  -1, 2.5,
  1, 3.5,
  2.5, 5,
  4.5, 9,
  6, 14,
  7.5, 22,
  9, 30,
];

/** Picks a text font stack the active basemap already serves, so labels never request missing glyphs. */
function detectFontStack(map: MapLibreMap): string[] | null {
  const layers = map.getStyle()?.layers ?? [];
  for (const layer of layers) {
    const font = (layer as { layout?: Record<string, unknown> }).layout?.["text-font"];
    if (Array.isArray(font) && font.length > 0 && font.every((f) => typeof f === "string")) return font as string[];
  }
  return null;
}

export function installLayers(map: MapLibreMap) {
  registerMapIcons(map);

  map.addSource(SOURCES.rings, { type: "geojson", data: EMPTY_FC });
  map.addSource(SOURCES.nearest, { type: "geojson", data: EMPTY_FC });
  map.addSource(SOURCES.earthquakes, {
    type: "geojson",
    data: EMPTY_FC,
    cluster: true,
    clusterRadius: 38,
    clusterMaxZoom: 6,
    clusterProperties: { maxMag: ["max", ["get", "mag"]] },
  });
  map.addSource(SOURCES.facilities, { type: "geojson", data: EMPTY_FC });
  map.addSource(SOURCES.selected, { type: "geojson", data: EMPTY_FC });

  const fontStack = detectFontStack(map);

  const layers: LayerSpecification[] = [
    {
      id: LAYERS.ringsFill,
      type: "fill",
      source: SOURCES.rings,
      paint: {
        "fill-color": FACILITY_COLORS.hospital,
        "fill-opacity": ["match", ["get", "radius"], 10, 0.1, 25, 0.06, 0.035],
      },
    },
    {
      id: LAYERS.ringsLine,
      type: "line",
      source: SOURCES.rings,
      paint: {
        "line-color": FACILITY_COLORS.hospital,
        "line-width": ["match", ["get", "radius"], 10, 1.6, 1.2],
        "line-opacity": ["match", ["get", "radius"], 10, 0.9, 25, 0.65, 0.45],
        "line-dasharray": [3, 2],
      },
    },
    {
      id: LAYERS.nearest,
      type: "line",
      source: SOURCES.nearest,
      layout: { "line-cap": "round" },
      paint: { "line-color": "#f8fafc", "line-width": 1.6, "line-dasharray": [1, 2], "line-opacity": 0.85 },
    },
    {
      id: LAYERS.clusters,
      type: "circle",
      source: SOURCES.earthquakes,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": severityColorBy(["get", "maxMag"]),
        "circle-opacity": 0.28,
        "circle-radius": ["step", ["get", "point_count"], 14, 10, 18, 50, 23, 200, 30],
        "circle-stroke-width": 1.5,
        "circle-stroke-color": severityColorBy(["get", "maxMag"]),
        "circle-stroke-opacity": 0.9,
      },
    },
    {
      id: LAYERS.glow,
      type: "circle",
      source: SOURCES.earthquakes,
      filter: ["all", ["!", ["has", "point_count"]], [">=", ["get", "mag"], 4.5]],
      paint: {
        "circle-color": ["get", "color"],
        "circle-radius": ["*", magnitudeRadius, 2.1],
        "circle-blur": 1,
        "circle-opacity": 0.45,
      },
    },
    {
      id: LAYERS.points,
      type: "circle",
      source: SOURCES.earthquakes,
      filter: ["!", ["has", "point_count"]],
      layout: { "circle-sort-key": ["get", "mag"] },
      paint: {
        "circle-color": ["get", "color"],
        "circle-radius": magnitudeRadius,
        "circle-opacity": 0.82,
        "circle-stroke-width": 1,
        "circle-stroke-color": "#0b1220",
      },
    },
    {
      id: LAYERS.facilities,
      type: "symbol",
      source: SOURCES.facilities,
      layout: {
        "icon-image": ["match", ["get", "category"], "hospital", "icon-hospital", "icon-emergency"],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 4, 0.55, 9, 0.85, 13, 1],
        "icon-allow-overlap": true,
        "symbol-sort-key": ["match", ["get", "category"], "hospital", 2, 1],
      },
    },
    {
      id: LAYERS.selectedHalo,
      type: "circle",
      source: SOURCES.selected,
      paint: {
        "circle-radius": ["+", magnitudeRadius, 9],
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-width": 2,
        "circle-stroke-color": "#f8fafc",
        "circle-stroke-opacity": 0.9,
      },
    },
    {
      id: LAYERS.selectedPoint,
      type: "circle",
      source: SOURCES.selected,
      paint: {
        "circle-radius": ["+", magnitudeRadius, 2],
        "circle-color": ["get", "color"],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#0b1220",
      },
    },
  ];

  if (fontStack) {
    layers.splice(4, 0, {
      id: LAYERS.clusterCount,
      type: "symbol",
      source: SOURCES.earthquakes,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": fontStack,
        "text-size": 11,
        "text-allow-overlap": true,
      },
      paint: { "text-color": "#f8fafc" },
    });
  }

  layers.forEach((layer) => map.addLayer(layer));
}

const EARTHQUAKE_LAYERS = [LAYERS.clusters, LAYERS.clusterCount, LAYERS.glow, LAYERS.points];

export function applyLayerVisibility(map: MapLibreMap, layers: LayerVisibility) {
  EARTHQUAKE_LAYERS.forEach((id) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", layers.earthquakes ? "visible" : "none");
  });
  if (map.getLayer(LAYERS.facilities)) {
    const categories = [layers.hospitals && "hospital", layers.emergency && "emergency"].filter(Boolean) as string[];
    map.setFilter(LAYERS.facilities, ["in", ["get", "category"], ["literal", categories]]);
  }
}
