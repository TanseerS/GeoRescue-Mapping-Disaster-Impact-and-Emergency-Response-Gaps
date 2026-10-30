/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AWS_REGION?: string;
  readonly VITE_AWS_LOCATION_API_KEY?: string;
  readonly VITE_AWS_LOCATION_MAP_STYLE?: string;
  readonly VITE_AWS_LOCATION_COLOR_SCHEME?: string;
  readonly VITE_FALLBACK_MAP_STYLE_URL?: string;
  readonly VITE_USGS_FEED_BASE_URL?: string;
  readonly VITE_OVERPASS_ENDPOINTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
