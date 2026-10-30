import { env, isAwsMapConfigured } from "../config/env";

export type MapProvider = "amazon-location" | "open-fallback";

export interface ResolvedMapStyle {
  provider: MapProvider;
  url: string;
  label: string;
  attribution: string;
  /** Adds the API key to Amazon Location tile requests (MapLibre `transformRequest`). */
  transformRequest?: (url: string) => { url: string };
}

/** Styles offered by the Amazon Location Maps API v2. Color schemes apply to Standard and Monochrome only. */
const AWS_STYLES = ["Standard", "Monochrome", "Hybrid", "Satellite"] as const;
const AWS_COLOR_SCHEMES = ["Dark", "Light"] as const;
const REGION_PATTERN = /^[a-z]{2}(-[a-z]+)+-\d$/;

type AwsStyle = (typeof AWS_STYLES)[number];

/** Validates the configured style values, falling back to safe defaults with a console warning. */
export function awsMapSettings(config = env.aws) {
  const style = (AWS_STYLES as readonly string[]).includes(config.mapStyle) ? (config.mapStyle as AwsStyle) : "Monochrome";
  const colorScheme = (AWS_COLOR_SCHEMES as readonly string[]).includes(config.colorScheme) ? config.colorScheme : "Dark";
  const region = REGION_PATTERN.test(config.region) ? config.region : "us-east-1";
  if (style !== config.mapStyle) console.warn(`Unknown VITE_AWS_LOCATION_MAP_STYLE "${config.mapStyle}", using ${style}.`);
  if (colorScheme !== config.colorScheme) console.warn(`Unknown VITE_AWS_LOCATION_COLOR_SCHEME "${config.colorScheme}", using ${colorScheme}.`);
  if (region !== config.region) console.warn(`Invalid VITE_AWS_REGION "${config.region}", using ${region}.`);
  return { style, colorScheme, region, apiKey: config.apiKey };
}

/** Amazon Location Service Maps API v2 style descriptor URL (API-key authentication). */
export function amazonLocationStyleUrl(config = env.aws): string {
  const { style, colorScheme, region, apiKey } = awsMapSettings(config);
  const params = new URLSearchParams({ key: apiKey });
  if (style === "Standard" || style === "Monochrome") params.set("color-scheme", colorScheme);
  return `https://maps.geo.${region}.amazonaws.com/v2/styles/${style}/descriptor?${params.toString()}`;
}

/**
 * The v2 style descriptor already embeds `?key=` in its tile URLs; this guards against styles or
 * sources that omit it so tiles never fail authorization. Only tile URLs (the one authorized call,
 * geo-maps:GetTile) on Amazon Location hosts are touched.
 */
export function amazonLocationTransform(apiKey: string) {
  return (url: string): { url: string } => {
    if (!/^https:\/\/maps\.geo\.[a-z0-9-]+\.amazonaws\.com\/v2\/tiles\//.test(url) || /[?&]key=/.test(url)) return { url };
    return { url: `${url}${url.includes("?") ? "&" : "?"}key=${encodeURIComponent(apiKey)}` };
  };
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
    label: `Amazon Location Service · ${awsMapSettings().style}`,
    attribution: "© AWS, © HERE, © OpenStreetMap contributors",
    transformRequest: amazonLocationTransform(env.aws.apiKey),
  };
}
