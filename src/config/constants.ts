import type { EarthquakeFilters, SeverityLevel, TimeRange } from "../types/earthquake";

export const FEEDS: Record<TimeRange, { file: string; label: string; short: string }> = {
  day: { file: "all_day.geojson", label: "Past 24 hours", short: "24h" },
  week: { file: "all_week.geojson", label: "Past 7 days", short: "7d" },
  month: { file: "all_month.geojson", label: "Past 30 days", short: "30d" },
};

export const TIME_RANGES: TimeRange[] = ["day", "week", "month"];

export interface SeverityDefinition {
  id: SeverityLevel;
  label: string;
  range: string;
  min: number;
  color: string;
  description: string;
}

/** Ordered from least to most severe. Thresholds follow the USGS 2.5 / 4.5 feed bands. */
export const SEVERITIES: SeverityDefinition[] = [
  { id: "minor", label: "Minor", range: "< 2.5", min: -Infinity, color: "#22c55e", description: "Usually not felt" },
  { id: "light", label: "Light", range: "2.5 – 4.4", min: 2.5, color: "#facc15", description: "Often felt, rarely damaging" },
  { id: "moderate", label: "Moderate", range: "4.5 – 5.9", min: 4.5, color: "#f97316", description: "Can damage weak structures" },
  { id: "strong", label: "Strong+", range: "≥ 6.0", min: 6.0, color: "#e11d48", description: "Potentially destructive" },
];

export const SEVERITY_BY_ID: Record<SeverityLevel, SeverityDefinition> = Object.fromEntries(
  SEVERITIES.map((s) => [s.id, s]),
) as Record<SeverityLevel, SeverityDefinition>;

export const MAGNITUDE_OPTIONS = [
  { value: -Infinity, label: "All" },
  { value: 1, label: "M1.0+" },
  { value: 2.5, label: "M2.5+" },
  { value: 4.5, label: "M4.5+" },
  { value: 6, label: "M6.0+" },
];

/** Magnitude at or above which an event is counted as significant (USGS 4.5+ feed threshold). */
export const SIGNIFICANT_MAGNITUDE = 4.5;

export const DEFAULT_FILTERS: EarthquakeFilters = {
  timeRange: "week",
  minMagnitude: -Infinity,
  severities: SEVERITIES.map((s) => s.id),
};

export const ANALYSIS_RADII_KM = [10, 25, 50] as const;
export const FACILITY_SEARCH_RADIUS_KM = 50;

/** Auto-refresh interval for the live USGS feed. USGS regenerates summary feeds every minute. */
export const AUTO_REFRESH_MS = 5 * 60 * 1000;

export const INITIAL_VIEW = { center: [20, 18] as [number, number], zoom: 1.6 };

export const FACILITY_COLORS = {
  hospital: "#38bdf8",
  emergency: "#a78bfa",
};
