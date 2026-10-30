import { SEVERITY_BY_ID } from "../config/constants";
import type { PopulationResponse } from "../services/population";
import type { GapAnalysis, ProximityRating } from "../types/analysis";
import type { Earthquake } from "../types/earthquake";
import { formatDistance, formatRelative, formatUtc } from "./format";
import { depthClass } from "./stats";

export interface CoverageClass {
  rating: ProximityRating;
  label: string;
  detail: string;
}

/** Human-readable coverage classes for the configured radii (straight-line distance to nearest mapped hospital). */
export function coverageClasses(radii: readonly number[]): Record<ProximityRating, CoverageClass> {
  const [r1, r2, r3] = radii;
  return {
    good: { rating: "good", label: "Close hospital proximity", detail: `Nearest mapped hospital within ${r1} km` },
    moderate: { rating: "moderate", label: "Moderate proximity", detail: `Nearest mapped hospital ${r1}–${r2} km away` },
    limited: { rating: "limited", label: "Limited proximity", detail: `Nearest mapped hospital ${r2}–${r3} km away` },
    critical: { rating: "critical", label: "Potential coverage gap", detail: `No mapped hospital within ${r3} km` },
  };
}

/** Rounds to 3 significant figures so estimates never look more precise than they are. */
export function formatPopulation(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  const digits = Math.floor(Math.log10(value)) + 1;
  const rounded = digits > 3 ? Math.round(value / 10 ** (digits - 3)) * 10 ** (digits - 3) : Math.round(value);
  if (rounded >= 1_000_000) return `${(rounded / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })} M`;
  return rounded.toLocaleString();
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

export interface IntelligenceBrief {
  headline: string;
  sections: { title: string; text: string }[];
  coverage: CoverageClass | null;
  limitations: string[];
  plainText: string;
}

export interface BriefInput {
  quake: Earthquake;
  analysis: GapAnalysis | null;
  radii: readonly number[];
  population: PopulationResponse | null;
  facilitiesUnavailable: boolean;
  now?: number;
}

/** Deterministic situation brief built only from loaded USGS, OpenStreetMap and WorldPop values. */
export function buildBrief({ quake, analysis, radii, population, facilitiesUnavailable, now = Date.now() }: BriefInput): IntelligenceBrief {
  const severity = SEVERITY_BY_ID[quake.severity];
  const depth = depthClass(quake.depthKm);
  const outer = radii[radii.length - 1];
  const sections: IntelligenceBrief["sections"] = [];

  sections.push({
    title: "Event",
    text:
      `Magnitude ${quake.magnitude.toFixed(1)}${quake.magnitudeType ? ` (${quake.magnitudeType})` : ""}, ${severity.label.toLowerCase()} band ` +
      `(${severity.description.toLowerCase()}). ${depth.label} focus at ${quake.depthKm.toFixed(1)} km depth. ` +
      `Recorded ${formatRelative(quake.time, now)} (${formatUtc(quake.time)}).` +
      (quake.tsunami ? " USGS tsunami flag is set." : "") +
      (quake.alert ? ` USGS PAGER alert level: ${quake.alert}.` : ""),
  });

  let coverage: CoverageClass | null = null;
  if (analysis) {
    const outerCounts = analysis.radii[analysis.radii.length - 1];
    const innerCounts = analysis.radii[0];
    const any = outerCounts.hospitals + outerCounts.clinics + outerCounts.emergency > 0;
    sections.push({
      title: "Mapped infrastructure",
      text: any
        ? `OpenStreetMap lists ${plural(outerCounts.hospitals, "hospital", "hospitals")}, ${plural(outerCounts.clinics, "clinic", "clinics")} and ` +
          `${plural(outerCounts.emergency, "emergency service", "emergency services")} (fire, ambulance, police) within ${outer} km; ` +
          `${plural(innerCounts.hospitals, "hospital", "hospitals")} within ${innerCounts.radiusKm} km.`
        : `No hospitals, clinics or emergency services are mapped in OpenStreetMap within ${outer} km.`,
    });
    const nearest: string[] = [];
    if (analysis.nearestHospital) nearest.push(`hospital: ${analysis.nearestHospital.name}, ${formatDistance(analysis.nearestHospital.distanceKm)}`);
    if (analysis.nearestFireStation) nearest.push(`fire station: ${analysis.nearestFireStation.name}, ${formatDistance(analysis.nearestFireStation.distanceKm)}`);
    sections.push({
      title: "Nearest facilities",
      text: nearest.length ? `Nearest mapped ${nearest.join("; nearest ")} (straight-line).` : `None mapped within ${outer} km.`,
    });
    coverage = coverageClasses(radii)[analysis.rating];
  } else if (facilitiesUnavailable) {
    sections.push({ title: "Mapped infrastructure", text: "OpenStreetMap facility data could not be loaded; proximity was not assessed." });
  }

  if (population) {
    const parts = population.results.map((r) => `≈ ${formatPopulation(r.population)} within ${r.radiusKm} km`);
    sections.push({
      title: "Population exposure (estimate)",
      text: `${parts.join(", ")} (${population.dataset} ${population.year}, ${population.resolution}). Residents, not casualties.`,
    });
  }

  const limitations = [
    "Distances are straight-line, not road travel distances or response times.",
    "Facility capacity, staffing, damage and availability are unknown.",
    "OpenStreetMap coverage varies by region; unmapped facilities may exist.",
  ];
  if (population) limitations.push("Population figures are modelled estimates of residents, not casualty or impact estimates.");

  const headline = `M${quake.magnitude.toFixed(1)} ${severity.label.toLowerCase()} earthquake · ${quake.place}`;
  const plainText = [
    `GeoRescue intelligence brief — ${headline}`,
    ...sections.map((s) => `${s.title}: ${s.text}`),
    coverage ? `Coverage classification: ${coverage.label} (${coverage.detail}; radii ${radii.join("/")} km).` : null,
    `Limitations: ${limitations.join(" ")}`,
    `Sources: USGS earthquake feed; OpenStreetMap via Overpass${population ? "; WorldPop" : ""}.`,
  ]
    .filter(Boolean)
    .join("\n");

  return { headline, sections, coverage, limitations, plainText };
}
