import { env, isAwsMapConfigured } from "../config/env";

export type MapProvider = "amazon-location" | "open-fallback";

export interface ResolvedMapStyle {
  provider: MapProvider;
  url: string;
  label: string;
  attribution: string;
}

/** Amazon Location Service Maps API v2 style descriptor URL (API-key authentication). */
export function amazonLocationStyleUrl(): string {
  const { region, mapStyle, colorScheme, apiKey } = env.aws;
  const params = new URLSearchParams({ key: apiKey });
  if (mapStyle === "Standard" || mapStyle === "Monochrome") params.set("color-scheme", colorScheme);
  return `https://maps.geo.${region}.amazonaws.com/v2/styles/${encodeURIComponent(mapStyle)}/descriptor?${params.toString()}`;
}

export function fallbackMapStyle(): ResolvedMapStyle {
  return {
    provider: "open-fallback",
    url: env.fallbackStyleUrl,
    label: "Open basemap (CARTO / OpenStreetMap)",
    attribution: "© OpenStreetMap contributors © CARTO",
  };
}

export function resolveMapStyle(): ResolvedMapStyle {
  if (!isAwsMapConfigured()) return fallbackMapStyle();
  return {
    provider: "amazon-location",
    url: amazonLocationStyleUrl(),
    label: `Amazon Location Service · ${env.aws.mapStyle}`,
    attribution: "© AWS, © HERE, © OpenStreetMap contributors",
  };
}
