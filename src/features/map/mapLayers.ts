import type { ExpressionSpecification, LayerSpecification, Map as MapLibreMap } from "maplibre-gl";
import { DEPTH_CLASSES, FACILITY_COLORS, SEVERITIES } from "../../config/constants";
import type { FacilityKind } from "../../types/facility";
import type { LayerVisibility, MapSettings } from "../../types/ui";
import { EMPTY_FC } from "./mapData";
import { registerMapIcons } from "./mapIcons";

export const SOURCES = {
  earthquakes: "gr-earthquakes",
  earthquakesClustered: "gr-earthquakes-clustered",
  selected: "gr-selected",
  rings: "gr-rings",
  ringLabels: "gr-ring-labels",
  facilities: "gr-facilities",
  selectedFacility: "gr-selected-facility",
  nearest: "gr-nearest",
  route: "gr-route",
} as const;

export const LAYERS = {
  heat: "gr-eq-heat",
  ringsFill: "gr-rings-fill",
  ringsLine: "gr-rings-line",
  ringLabels: "gr-ring-labels",
  nearest: "gr-nearest-line",
  routeCasing: "gr-route-casing",
  route: "gr-route-line",
  clusters: "gr-eq-clusters",
  clusterCount: "gr-eq-cluster-count",
  clusterGlow: "gr-eq-cl-glow",
  clusterPoints: "gr-eq-cl-points",
  glow: "gr-eq-glow",
  points: "gr-eq-points",
  facilities: "gr-facilities",
  selectedFacility: "gr-selected-facility",
  selectedHalo: "gr-selected-halo",
  selectedPoint: "gr-selected-point",
} as const;

/** Layers that respond to earthquake clicks/hover in any display mode. */
export const EARTHQUAKE_POINT_LAYERS = [LAYERS.points, LAYERS.clusterPoints];

function steps(input: ExpressionSpecification, base: string, stops: [number, string][]): ExpressionSpecification {
  return ["step", input, base, ...stops.flat()] as unknown as ExpressionSpecification;
}

const severityBy = (input: ExpressionSpecification) =>
  steps(input, SEVERITIES[0].color, SEVERITIES.slice(1).map((s) => [s.min, s.color] as [number, string]));

const depthBy = (input: ExpressionSpecification) =>
  steps(input, DEPTH_CLASSES[0].color, [
    [DEPTH_CLASSES[0].max, DEPTH_CLASSES[1].color],
    [DEPTH_CLASSES[1].max, DEPTH_CLASSES[2].color],
  ]);

function pointColor(colorBy: MapSettings["colorBy"]): ExpressionSpecification {
  return colorBy === "depth" ? depthBy(["get", "depth"]) : (["get", "color"] as ExpressionSpecification);
}

function clusterColor(colorBy: MapSettings["colorBy"]): ExpressionSpecification {
  return colorBy === "depth" ? depthBy(["/", ["get", "sumDepth"], ["get", "point_count"]]) : severityBy(["get", "maxMag"]);
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

function pointLayers(source: string, glowId: string, pointsId: string): LayerSpecification[] {
  const unclustered: ExpressionSpecification = ["!", ["has", "point_count"]];
  return [
    {
      id: glowId,
      type: "circle",
      source,
      filter: ["all", unclustered, [">=", ["get", "mag"], 4.5]],
      paint: {
        "circle-color": ["get", "color"],
        "circle-radius": ["*", magnitudeRadius, 2.1],
        "circle-blur": 1,
        "circle-opacity": 0.45,
      },
    },
    {
      id: pointsId,
      type: "circle",
      source,
      filter: unclustered,
      layout: { "circle-sort-key": ["get", "mag"] },
      paint: {
        "circle-color": ["get", "color"],
        "circle-radius": magnitudeRadius,
        "circle-opacity": 0.82,
        "circle-stroke-width": 1,
        "circle-stroke-color": "#0b1220",
      },
    },
  ];
}

export function installLayers(map: MapLibreMap) {
  registerMapIcons(map);

  for (const id of [SOURCES.rings, SOURCES.ringLabels, SOURCES.nearest, SOURCES.route, SOURCES.facilities, SOURCES.selectedFacility, SOURCES.selected]) {
    map.addSource(id, { type: "geojson", data: EMPTY_FC });
  }
  map.addSource(SOURCES.earthquakes, { type: "geojson", data: EMPTY_FC });
  map.addSource(SOURCES.earthquakesClustered, {
    type: "geojson",
    data: EMPTY_FC,
    cluster: true,
    clusterRadius: 38,
    clusterMaxZoom: 6,
    clusterProperties: { maxMag: ["max", ["get", "mag"]], sumDepth: ["+", ["get", "depth"]] },
  });

  const fontStack = detectFontStack(map);

  const layers: LayerSpecification[] = [
    {
      id: LAYERS.heat,
      type: "heatmap",
      source: SOURCES.earthquakes,
      paint: {
        // Magnitude-weighted density: larger events contribute more heat.
        "heatmap-weight": ["interpolate", ["linear"], ["get", "mag"], 0, 0.04, 2, 0.12, 4, 0.4, 6, 1],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 0.7, 6, 1.6, 9, 2.6],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 7, 4, 15, 8, 28, 11, 40],
        "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.9, 8, 0.75, 11, 0.4],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0, "rgba(0,0,0,0)",
          0.15, "rgba(76,29,149,0.55)",
          0.35, "#7c3aed",
          0.55, "#db2777",
          0.75, "#f97316",
          1, "#fde047",
        ],
      },
    },
    {
      id: LAYERS.ringsFill,
      type: "fill",
      source: SOURCES.rings,
      paint: {
        "fill-color": FACILITY_COLORS.hospital,
        "fill-opacity": ["match", ["get", "index"], 0, 0.1, 1, 0.06, 0.035],
      },
    },
    {
      id: LAYERS.ringsLine,
      type: "line",
      source: SOURCES.rings,
      paint: {
        "line-color": FACILITY_COLORS.hospital,
        "line-width": ["match", ["get", "index"], 0, 1.6, 1.2],
        "line-opacity": ["match", ["get", "index"], 0, 0.9, 1, 0.65, 0.45],
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
      id: LAYERS.routeCasing,
      type: "line",
      source: SOURCES.route,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#020617", "line-width": 7, "line-opacity": 0.85 },
    },
    {
      id: LAYERS.route,
      type: "line",
      source: SOURCES.route,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#f8fafc", "line-width": 3.5 },
    },
    {
      id: LAYERS.clusters,
      type: "circle",
      source: SOURCES.earthquakesClustered,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": clusterColor("severity"),
        "circle-opacity": 0.28,
        "circle-radius": ["step", ["get", "point_count"], 14, 10, 18, 50, 23, 200, 30],
        "circle-stroke-width": 1.5,
        "circle-stroke-color": clusterColor("severity"),
        "circle-stroke-opacity": 0.9,
      },
    },
    ...pointLayers(SOURCES.earthquakesClustered, LAYERS.clusterGlow, LAYERS.clusterPoints),
    ...pointLayers(SOURCES.earthquakes, LAYERS.glow, LAYERS.points),
    {
      id: LAYERS.facilities,
      type: "symbol",
      source: SOURCES.facilities,
      layout: {
        "icon-image": ["concat", "icon-", ["get", "kind"]],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 4, 0.55, 9, 0.85, 13, 1],
        "icon-allow-overlap": true,
        "symbol-sort-key": ["match", ["get", "kind"], "hospital", 3, "clinic", 1, 2],
      },
    },
    {
      id: LAYERS.selectedFacility,
      type: "circle",
      source: SOURCES.selectedFacility,
      paint: {
        "circle-radius": 15,
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-width": 2.5,
        "circle-stroke-color": "#f8fafc",
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
    const clusterIndex = layers.findIndex((l) => l.id === LAYERS.clusters);
    layers.splice(clusterIndex + 1, 0, {
      id: LAYERS.clusterCount,
      type: "symbol",
      source: SOURCES.earthquakesClustered,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": fontStack,
        "text-size": 11,
        "text-allow-overlap": true,
      },
      paint: { "text-color": "#f8fafc" },
    });
    const nearestIndex = layers.findIndex((l) => l.id === LAYERS.nearest);
    layers.splice(nearestIndex, 0, {
      id: LAYERS.ringLabels,
      type: "symbol",
      source: SOURCES.ringLabels,
      layout: { "text-field": ["get", "label"], "text-font": fontStack, "text-size": 11, "text-offset": [0, -0.7] },
      paint: { "text-color": "#bae6fd", "text-halo-color": "#020617", "text-halo-width": 1.5 },
    });
  }

  layers.forEach((layer) => map.addLayer(layer));
}

function setVisible(map: MapLibreMap, id: string, visible: boolean) {
  if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
}

/** Applies display mode, color encoding and layer toggles without re-adding layers. */
export function applyMapSettings(map: MapLibreMap, layers: LayerVisibility, settings: MapSettings) {
  const eq = layers.earthquakes;
  const mode = settings.displayMode;
  setVisible(map, LAYERS.heat, eq && mode === "heatmap");
  for (const id of [LAYERS.clusters, LAYERS.clusterCount, LAYERS.clusterGlow, LAYERS.clusterPoints]) setVisible(map, id, eq && mode === "clusters");
  for (const id of [LAYERS.glow, LAYERS.points]) {
    setVisible(map, id, eq && mode !== "clusters");
    // In heatmap mode, individual events fade in only once zoomed in.
    if (map.getLayer(id)) map.setLayerZoomRange(id, mode === "heatmap" ? 6 : 0, 24);
  }

  const color = pointColor(settings.colorBy);
  for (const id of [LAYERS.points, LAYERS.clusterPoints, LAYERS.glow, LAYERS.clusterGlow]) {
    if (map.getLayer(id)) map.setPaintProperty(id, "circle-color", color);
  }
  if (map.getLayer(LAYERS.clusters)) {
    map.setPaintProperty(LAYERS.clusters, "circle-color", clusterColor(settings.colorBy));
    map.setPaintProperty(LAYERS.clusters, "circle-stroke-color", clusterColor(settings.colorBy));
  }

  if (map.getLayer(LAYERS.facilities)) {
    const kinds = (Object.keys(layers.facilities) as FacilityKind[]).filter((k) => layers.facilities[k]);
    map.setFilter(LAYERS.facilities, ["in", ["get", "kind"], ["literal", kinds]]);
  }
}

