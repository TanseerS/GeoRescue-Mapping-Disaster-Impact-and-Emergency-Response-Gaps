import type { Feature, FeatureCollection, LineString, Point, Polygon } from "geojson";
import { ANALYSIS_RADII_KM, SEVERITY_BY_ID } from "../../config/constants";
import type { GapAnalysis } from "../../types/analysis";
import type { Earthquake } from "../../types/earthquake";
import type { Facility } from "../../types/facility";
import { radiusCircle } from "../../utils/geo";

export const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };

export function earthquakesToGeoJSON(earthquakes: Earthquake[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: earthquakes.map((q) => ({
      type: "Feature",
      properties: {
        id: q.id,
        mag: q.magnitude,
        severity: q.severity,
        color: SEVERITY_BY_ID[q.severity].color,
        place: q.place,
        time: q.time,
        depth: q.depthKm,
      },
      geometry: { type: "Point", coordinates: [q.longitude, q.latitude] },
    })),
  };
}

export function selectedToGeoJSON(selected: Earthquake | null): FeatureCollection<Point> {
  if (!selected) return { type: "FeatureCollection", features: [] };
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { mag: selected.magnitude, color: SEVERITY_BY_ID[selected.severity].color },
        geometry: { type: "Point", coordinates: [selected.longitude, selected.latitude] },
      },
    ],
  };
}

export function ringsToGeoJSON(selected: Earthquake | null): FeatureCollection<Polygon> {
  if (!selected) return { type: "FeatureCollection", features: [] };
  return {
    type: "FeatureCollection",
    features: [...ANALYSIS_RADII_KM]
      .sort((a, b) => b - a)
      .map((radius) => {
        const ring = radiusCircle(selected, radius);
        return { ...ring, properties: { radius } };
      }),
  };
}

export function facilitiesToGeoJSON(facilities: Facility[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: facilities.map((f) => ({
      type: "Feature",
      properties: { id: f.id, name: f.name, kind: f.kind, category: f.category, osmUrl: f.osmUrl },
      geometry: { type: "Point", coordinates: [f.longitude, f.latitude] },
    })),
  };
}

export function nearestLineToGeoJSON(selected: Earthquake | null, analysis: GapAnalysis | null): FeatureCollection<LineString> {
  const target = analysis?.nearestHospital;
  if (!selected || !target) return { type: "FeatureCollection", features: [] };
  const line: Feature<LineString> = {
    type: "Feature",
    properties: { distance: target.distanceKm },
    geometry: {
      type: "LineString",
      coordinates: [
        [selected.longitude, selected.latitude],
        [target.longitude, target.latitude],
      ],
    },
  };
  return { type: "FeatureCollection", features: [line] };
}
