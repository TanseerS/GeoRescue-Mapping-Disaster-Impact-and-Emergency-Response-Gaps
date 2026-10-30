import { env } from "../config/env";
import { awsMapSettings } from "./mapStyle";

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [number, number][];
}

interface Position {
  longitude: number;
  latitude: number;
}

interface RoutesResponse {
  Routes?: {
    Summary?: { Distance?: number; Duration?: number };
    Legs?: {
      Geometry?: { LineString?: [number, number][] };
      VehicleLegDetails?: {
        Summary?: { Overview?: { Distance?: number; Duration?: number } };
        TravelSteps?: { Distance?: number; Duration?: number }[];
      };
    }[];
  }[];
}

const sum = (values: (number | undefined)[]) => values.reduce<number>((total, v) => total + (v ?? 0), 0);

/** Extracts distance, duration and geometry from an Amazon Location Routes v2 CalculateRoutes response. */
export function parseRoutesResponse(data: RoutesResponse): RouteResult {
  const route = data.Routes?.[0];
  if (!route) throw new Error("No drivable route was found between these locations.");
  const legs = route.Legs ?? [];
  const coordinates = legs.flatMap((leg) => leg.Geometry?.LineString ?? []);
  const legDistance = sum(legs.map((l) => l.VehicleLegDetails?.Summary?.Overview?.Distance ?? sum((l.VehicleLegDetails?.TravelSteps ?? []).map((s) => s.Distance))));
  const legDuration = sum(legs.map((l) => l.VehicleLegDetails?.Summary?.Overview?.Duration ?? sum((l.VehicleLegDetails?.TravelSteps ?? []).map((s) => s.Duration))));
  const distanceMeters = route.Summary?.Distance ?? legDistance;
  const durationSeconds = route.Summary?.Duration ?? legDuration;
  if (coordinates.length < 2 || !Number.isFinite(distanceMeters)) throw new Error("The routing service returned an incomplete route.");
  return { distanceMeters, durationSeconds, coordinates };
}

/**
 * Calculates a car route with the Amazon Location Routes API (v2) using the browser API key.
 * Durations are the service's estimates for typical conditions, not live emergency response times.
 */
export async function calculateRoute(origin: Position, destination: Position, signal?: AbortSignal, config = env.aws): Promise<RouteResult> {
  const { region } = awsMapSettings(config);
  let response: Response;
  try {
    response = await fetch(`https://routes.geo.${region}.amazonaws.com/v2/routes?key=${encodeURIComponent(config.apiKey)}`, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Origin: [origin.longitude, origin.latitude],
        Destination: [destination.longitude, destination.latitude],
        TravelMode: "Car",
        LegGeometryFormat: "Simple",
        LegAdditionalFeatures: ["Summary"],
      }),
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new Error("Amazon Location routing service is unreachable.");
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error("The API key is not authorized for routing (geo-routes:CalculateRoutes).");
  }
  if (response.status === 400 || response.status === 404) {
    throw new Error("No drivable route was found. The epicenter may be offshore or far from the road network.");
  }
  if (!response.ok) throw new Error(`Routing service responded with HTTP ${response.status}.`);
  return parseRoutesResponse((await response.json()) as RoutesResponse);
}
