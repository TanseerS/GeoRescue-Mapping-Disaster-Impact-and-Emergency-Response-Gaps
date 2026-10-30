const trim = (value: string | undefined): string => (value ?? "").trim();

const DEFAULT_FALLBACK_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const DEFAULT_USGS_BASE = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary";
const DEFAULT_OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

export const env = {
  /** GeoRescue AWS API (API Gateway URL). Empty means the browser reads USGS directly. */
  apiBaseUrl: trim(import.meta.env.VITE_API_BASE_URL).replace(/\/+$/, ""),
  /** When the AWS API fails, fall back to the direct USGS feed (default true). */
  apiFallbackToUsgs: trim(import.meta.env.VITE_API_FALLBACK_TO_USGS).toLowerCase() !== "false",
  aws: {
    region: trim(import.meta.env.VITE_AWS_REGION) || "us-east-1",
    apiKey: trim(import.meta.env.VITE_AWS_LOCATION_API_KEY),
    mapStyle: trim(import.meta.env.VITE_AWS_LOCATION_MAP_STYLE) || "Monochrome",
    colorScheme: trim(import.meta.env.VITE_AWS_LOCATION_COLOR_SCHEME) || "Dark",
  },
  fallbackStyleUrl: trim(import.meta.env.VITE_FALLBACK_MAP_STYLE_URL) || DEFAULT_FALLBACK_STYLE,
  usgsBaseUrl: (trim(import.meta.env.VITE_USGS_FEED_BASE_URL) || DEFAULT_USGS_BASE).replace(/\/$/, ""),
  overpassEndpoints: trim(import.meta.env.VITE_OVERPASS_ENDPOINTS)
    ? trim(import.meta.env.VITE_OVERPASS_ENDPOINTS)
        .split(",")
        .map((url) => url.trim())
        .filter(Boolean)
    : DEFAULT_OVERPASS,
};

export const isAwsMapConfigured = (): boolean => env.aws.apiKey.length > 0;

export const isAwsApiConfigured = (): boolean => env.apiBaseUrl.length > 0;
