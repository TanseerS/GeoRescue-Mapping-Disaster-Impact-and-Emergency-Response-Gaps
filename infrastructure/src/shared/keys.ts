/** S3 object layout. Everything lives under these two prefixes, which IAM policies are scoped to. */
export const KEYS = {
  /** Latest processed USGS all_day feed (GeoJSON FeatureCollection). */
  latest: "earthquakes/latest.geojson",
  /** Rolling 30-day window merged from successive ingestions; the API serves from this. */
  window: "earthquakes/window-30d.geojson",
  /** Ingestion status: last success, last attempt and statistics. */
  metadata: "metadata/latest.json",
} as const;

/** Hourly snapshot key, e.g. earthquakes/history/2026/10/30/14.json (UTC). */
export function historyKey(epochMs: number): string {
  const d = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `earthquakes/history/${d.getUTCFullYear()}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}/${pad(d.getUTCHours())}.json`;
}
