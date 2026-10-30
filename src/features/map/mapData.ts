import type { Feature, FeatureCollection, LineString, Point, Polygon } from "geojson";
import { SEVERITY_BY_ID } from "../../config/constants";
import type { GapAnalysis } from "../../types/analysis";
import type { Earthquake } from "../../types/earthquake";
import type { Facility } from "../../types/facility";
import { radiusCircle } from "../../utils/geo";

export const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };

const collection = <G extends Point | Polygon | LineString>(features: Feature<G>[]): FeatureCollection<G> => ({
  type: "FeatureCollection",
  features,
});

export function earthquakesToGeoJSON(earthquakes: Earthquake[]): FeatureCollection<Point> {
  return collection(
    earthquakes.map((q) => ({
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
  );
}

export function selectedToGeoJSON(selected: Earthquake | null): FeatureCollection<Point> {
  if (!selected) return collection([]);
  return collection([
    {
      type: "Feature",
      properties: { mag: selected.magnitude, depth: selected.depthKm, color: SEVERITY_BY_ID[selected.severity].color },
      geometry: { type: "Point", coordinates: [selected.longitude, selected.latitude] },
    },
  ]);
}

/** Analysis rings, largest first so smaller rings draw on top. */
export function ringsToGeoJSON(selected: Earthquake | null, radii: readonly number[]): FeatureCollection<Polygon> {
  if (!selected) return collection([]);
  return collection(
    [...radii]
      .map((radius, index) => ({ radius, index }))
      .sort((a, b) => b.radius - a.radius)
      .map(({ radius, index }) => ({ ...radiusCircle(selected, radius), properties: { radius, index } })),
  );
}

/** Label anchors on the northern edge of each ring. */
export function ringLabelsToGeoJSON(selected: Earthquake | null, radii: readonly number[]): FeatureCollection<Point> {
  if (!selected) return collection([]);
  return collection(
    radii.map((radius, index) => ({
      type: "Feature",
      properties: { label: `${radius} km`, index },
      geometry: { type: "Point", coordinates: [selected.longitude, Math.min(selected.latitude + radius / 111.2, 85)] },
    })),
  );
}

export function facilitiesToGeoJSON(facilities: Facility[]): FeatureCollection<Point> {
  return collection(
    facilities.map((f) => ({
      type: "Feature",
      properties: { id: f.id, name: f.name, kind: f.kind, category: f.category },
      geometry: { type: "Point", coordinates: [f.longitude, f.latitude] },
    })),
  );
}

export function pointToGeoJSON(point: { longitude: number; latitude: number } | null): FeatureCollection<Point> {
  if (!point) return collection([]);
  return collection([{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [point.longitude, point.latitude] } }]);
}

export function nearestLineToGeoJSON(selected: Earthquake | null, analysis: GapAnalysis | null): FeatureCollection<LineString> {
  const target = analysis?.nearestHospital;
  if (!selected || !target) return collection([]);
  return collection([
    {
      type: "Feature",
      properties: { distance: target.distanceKm },
      geometry: {
        type: "LineString",
        coordinates: [
          [selected.longitude, selected.latitude],
          [target.longitude, target.latitude],
        ],
      },
    },
  ]);
}

export function routeToGeoJSON(coordinates: [number, number][] | null): FeatureCollection<LineString> {
  if (!coordinates || coordinates.length < 2) return collection([]);
  return collection([{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } }]);
}
