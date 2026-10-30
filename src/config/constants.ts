import type { EarthquakeFilters, SeverityLevel, TimeRange } from "../types/earthquake";
import type { FacilityKind } from "../types/facility";

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

/** Default analysis radii (km). Users can choose other presets or custom values up to the search radius. */
export const ANALYSIS_RADII_KM = [10, 25, 50] as const;
/** Overpass search radius around an epicenter; analysis radii can never exceed it. */
export const FACILITY_SEARCH_RADIUS_KM = 50;

export type AnalysisRadii = [number, number, number];

export const RADIUS_PRESETS: { id: string; label: string; radii: AnalysisRadii; description: string }[] = [
  { id: "urban", label: "Urban", radii: [5, 10, 20], description: "Dense cities with short distances between facilities" },
  { id: "standard", label: "Standard", radii: [10, 25, 50], description: "General-purpose default" },
  { id: "rural", label: "Rural", radii: [20, 35, 50], description: "Sparse regions with longer distances" },
];

/** Auto-refresh interval for the live USGS feed. USGS regenerates summary feeds every minute. */
export const AUTO_REFRESH_MS = 5 * 60 * 1000;

/** Global view framing every inhabited continent. */
export const INITIAL_BOUNDS: [[number, number], [number, number]] = [
  [-168, -48],
  [178, 68],
];

/** Group colors: health facilities (hospitals, clinics) and emergency services. Icons add a per-type glyph. */
export const FACILITY_COLORS = {
  hospital: "#38bdf8",
  emergency: "#8b5cf6",
};

export interface FacilityKindDefinition {
  id: FacilityKind;
  label: string;
  plural: string;
  group: "health" | "emergency";
  color: string;
}

export const FACILITY_KINDS: FacilityKindDefinition[] = [
  { id: "hospital", label: "Hospital", plural: "Hospitals", group: "health", color: FACILITY_COLORS.hospital },
  { id: "clinic", label: "Clinic", plural: "Clinics", group: "health", color: FACILITY_COLORS.hospital },
  { id: "fire_station", label: "Fire station", plural: "Fire stations", group: "emergency", color: FACILITY_COLORS.emergency },
  { id: "ambulance_station", label: "Ambulance station", plural: "Ambulance stations", group: "emergency", color: FACILITY_COLORS.emergency },
  { id: "police", label: "Police station", plural: "Police stations", group: "emergency", color: FACILITY_COLORS.emergency },
];

export const FACILITY_KIND_BY_ID = Object.fromEntries(FACILITY_KINDS.map((k) => [k.id, k])) as Record<
  FacilityKind,
  FacilityKindDefinition
>;

/** Coverage class colors reuse the ordered severity scale (green → red). */
export const COVERAGE_COLORS = {
  good: "#22c55e",
  moderate: "#facc15",
  limited: "#f97316",
  critical: "#e11d48",
} as const;

/** Earthquake depth classes used in seismology (focal depth). */
export const DEPTH_CLASSES = [
  { id: "shallow", label: "Shallow", range: "0–70 km", max: 70, color: "#ccfbf1" },
  { id: "intermediate", label: "Intermediate", range: "70–300 km", max: 300, color: "#2dd4bf" },
  { id: "deep", label: "Deep", range: "> 300 km", max: Infinity, color: "#0f766e" },
] as const;
