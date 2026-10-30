import { AlertOctagon, AlertTriangle, CheckCircle2, Flame, Hospital, Info, Navigation, Route, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "../../components/ChartTooltip";
import { EmptyState } from "../../components/ui/EmptyState";
import { PanelHeader, Section } from "../../components/ui/PanelHeader";
import { MagnitudeChip } from "../../components/ui/SeverityBadge";
import { Spinner } from "../../components/ui/Spinner";
import { COVERAGE_COLORS, FACILITY_COLORS, FACILITY_KINDS, type AnalysisRadii } from "../../config/constants";
import type { PopulationState } from "../../hooks/usePopulation";
import type { RouteState } from "../../hooks/useRoute";
import type { GapAnalysis, ProximityRating } from "../../types/analysis";
import type { Earthquake } from "../../types/earthquake";
import type { Facility, FacilityResult, FacilityWithDistance } from "../../types/facility";
import { formatDistance, formatMagnitude } from "../../utils/format";
import { coverageClasses } from "../../utils/intelligence";
import { FacilityStatus } from "../facilities/FacilityStatus";
import { PopulationExposure } from "./PopulationExposure";
import { RadiusControls } from "./RadiusControls";

const RATING_ICON: Record<ProximityRating, ReactNode> = {
  good: <CheckCircle2 className="h-5 w-5" />,
  moderate: <Info className="h-5 w-5" />,
  limited: <AlertTriangle className="h-5 w-5" />,
  critical: <AlertOctagon className="h-5 w-5" />,
};

export interface RoutingControls {
  enabled: boolean;
  state: RouteState;
  request: (facility: Facility) => void;
}

interface GapAnalysisPanelProps {
  candidates: Earthquake[];
  selected: Earthquake | null;
  result: FacilityResult | undefined;
  analysis: GapAnalysis | null;
  radii: AnalysisRadii;
  onRadiiChange: (radii: AnalysisRadii) => void;
  population: PopulationState;
  onRetryPopulation: () => void;
  routing: RoutingControls;
  onSelect: (id: string) => void;
  onRetry: () => void;
  onFocusFacility: (facility: FacilityWithDistance) => void;
}

export function GapAnalysisPanel(props: GapAnalysisPanelProps) {
  const { candidates, selected, result, analysis, radii } = props;
  const options = [...candidates].sort((a, b) => b.magnitude - a.magnitude).slice(0, 300);
  if (selected && !options.some((o) => o.id === selected.id)) options.unshift(selected);

  return (
    <div className="flex h-full flex-col">
      <PanelHeader kicker="Turf.js geographic proximity model" title="Response Gap Analysis" />

      <div className="border-b border-white/[0.06] px-4 py-3">
        <label htmlFor="gap-quake" className="mb-1.5 block text-xs text-ink-300">
          Earthquake to analyze
        </label>
        <select
          id="gap-quake"
          value={selected?.id ?? ""}
          onChange={(e) => e.target.value && props.onSelect(e.target.value)}
          className="h-9 w-full rounded-lg border border-white/[0.08] bg-ink-850 px-2.5 text-sm text-ink-100 focus:border-sky-400/50 focus:outline-none"
        >
          <option value="" disabled>
            Select an earthquake ({options.length} strongest listed)
          </option>
          {options.map((q) => (
            <option key={q.id} value={q.id}>
              M{formatMagnitude(q.magnitude)} · {q.place}
            </option>
          ))}
        </select>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {!selected ? (
          <>
            <EmptyState
              icon={<ShieldAlert className="h-5 w-5" />}
              title="Choose an earthquake"
              description="GeoRescue counts mapped hospitals, clinics and emergency services within three configurable radii, finds the nearest hospital and fire station, and classifies geographic coverage."
            />
            {options.length > 0 && (
              <Section title="Quick picks · strongest events">
                <ul className="space-y-0.5">
                  {options.slice(0, 5).map((q) => (
                    <li key={q.id}>
                      <button
                        type="button"
                        onClick={() => props.onSelect(q.id)}
                        className="flex w-full items-center gap-3 rounded-lg px-1.5 py-1.5 text-left hover:bg-white/[0.04]"
                      >
                        <MagnitudeChip magnitude={q.magnitude} level={q.severity} />
                        <span className="min-w-0 flex-1 truncate text-[13px] text-ink-100">{q.place}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </>
        ) : (
          <>
            <Section title="Analysis radii" aside={<span className="text-[10.5px] text-ink-500">drawn on the map</span>}>
              <RadiusControls radii={radii} onChange={props.onRadiiChange} />
            </Section>
            {result?.status !== "success" || !analysis ? (
              <div className="px-4 pb-4">
                <FacilityStatus result={result} onRetry={props.onRetry} />
              </div>
            ) : (
              <AnalysisResult {...props} analysis={analysis} />
            )}
          </>
        )}

        <div className="mx-4 mb-4 mt-1 rounded-lg border border-amber-300/15 bg-amber-300/[0.04] px-3 py-2.5 text-[11px] leading-relaxed text-amber-100/80">
          <p className="mb-0.5 flex items-center gap-1.5 font-semibold text-amber-200">
            <Info className="h-3.5 w-3.5" /> Geographic proximity only — not a response assessment
          </p>
          Distances are straight-line (great-circle) measurements to facilities mapped in OpenStreetMap. Facility availability,
          capacity, staffing, damage, road conditions and actual response times are not known. OSM coverage is incomplete in
          many regions. Use these results only to prioritize further investigation.
        </div>
      </div>
    </div>
  );
}

function CoverageScale({ radii, rating }: { radii: readonly number[]; rating: ProximityRating }) {
  const classes = coverageClasses(radii);
  return (
    <div className="mt-2.5 grid grid-cols-4 gap-1" aria-label="Coverage classification thresholds">
      {(Object.keys(classes) as ProximityRating[]).map((r) => (
        <div
          key={r}
          className={`rounded-md px-1.5 py-1 text-center text-[10px] leading-tight ${r === rating ? "ring-1 ring-white/40" : "opacity-60"}`}
          style={{ backgroundColor: `${COVERAGE_COLORS[r]}18`, color: COVERAGE_COLORS[r] }}
          title={classes[r].detail}
        >
          {r === "good" ? `≤ ${radii[0]} km` : r === "moderate" ? `≤ ${radii[1]} km` : r === "limited" ? `≤ ${radii[2]} km` : `> ${radii[2]} km`}
        </div>
      ))}
    </div>
  );
}

function NearestCard({
  facility,
  label,
  icon,
  color,
  routing,
  onFocus,
}: {
  facility: FacilityWithDistance | null;
  label: string;
  icon: ReactNode;
  color: string;
  routing: RoutingControls;
  onFocus: (f: FacilityWithDistance) => void;
}) {
  if (!facility) {
    return (
      <p className="rounded-xl border border-dashed border-white/[0.1] px-3 py-2.5 text-xs text-ink-400">
        No {label.toLowerCase()} mapped within the analysis radius.
      </p>
    );
  }
  const route = routing.state.status !== "idle" && routing.state.facilityId === facility.id ? routing.state : null;
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02]">
      <button type="button" onClick={() => onFocus(facility)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ color, backgroundColor: `${color}1a` }}>
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10.5px] uppercase tracking-wider text-ink-500">Nearest {label.toLowerCase()}</span>
          <span className="block truncate text-[13px] font-medium text-white">{facility.name}</span>
          <span className="flex items-center gap-1 text-[11px] text-ink-400">
            <Navigation className="h-3 w-3" /> Show on map
          </span>
        </span>
        <span className="text-right">
          <span className="num block text-lg font-semibold text-white">{formatDistance(facility.distanceKm)}</span>
          <span className="text-[10.5px] text-ink-500">straight-line</span>
        </span>
      </button>
      {routing.enabled && (
        <div className="border-t border-white/[0.06] px-3 py-2 text-[11.5px]">
          {route?.status === "success" ? (
            <p className="text-ink-200">
              <Route className="mr-1 inline h-3.5 w-3.5 text-sky-300" />
              Driving route: <span className="num font-semibold text-white">{(route.result.distanceMeters / 1000).toFixed(1)} km</span> ·{" "}
              <span className="num font-semibold text-white">{Math.round(route.result.durationSeconds / 60)} min</span>
              <span className="text-ink-500"> (Amazon Location estimate, typical traffic)</span>
            </p>
          ) : route?.status === "error" ? (
            <p className="text-rose-300">{route.error}</p>
          ) : (
            <button
              type="button"
              onClick={() => routing.request(facility)}
              disabled={route?.status === "loading"}
              className="inline-flex items-center gap-1.5 font-medium text-sky-300 hover:text-sky-200 disabled:opacity-60"
            >
              {route?.status === "loading" ? <Spinner className="h-3.5 w-3.5" /> : <Route className="h-3.5 w-3.5" />}
              Calculate driving route to epicenter
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AnalysisResult(props: GapAnalysisPanelProps & { analysis: GapAnalysis }) {
  const { analysis, radii, routing } = props;
  const coverage = coverageClasses(radii)[analysis.rating];
  const color = COVERAGE_COLORS[analysis.rating];
  const chartData = analysis.radii.map((r) => ({ radius: `${r.radiusKm} km`, Health: r.hospitals + r.clinics, Emergency: r.emergency }));

  return (
    <div className="animate-fade-in">
      <div className="px-4">
        <div className="rounded-xl border px-3.5 py-3" style={{ borderColor: `${color}40`, backgroundColor: `${color}0f` }} role="status">
          <div className="flex items-start gap-3">
            <span style={{ color }}>{RATING_ICON[analysis.rating]}</span>
            <div>
              <p className="text-sm font-semibold text-white">{coverage.label}</p>
              <p className="mt-0.5 text-xs text-ink-300">{coverage.detail} (straight-line).</p>
            </div>
          </div>
          <CoverageScale radii={radii} rating={analysis.rating} />
        </div>
      </div>

      <Section title="Mapped facilities within radius">
        <div className="overflow-hidden rounded-lg border border-white/[0.06]">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-white/[0.03] text-[10.5px] uppercase tracking-wider text-ink-400">
                <th className="px-2.5 py-1.5 text-left font-medium">Type</th>
                {analysis.radii.map((r) => (
                  <th key={r.radiusKm} className="px-2 py-1.5 text-right font-medium">
                    ≤ {r.radiusKm} km
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {FACILITY_KINDS.map((kind) => (
                <tr key={kind.id}>
                  <td className="flex items-center gap-1.5 px-2.5 py-1.5 text-ink-200">
                    <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: kind.color }} />
                    {kind.plural}
                  </td>
                  {analysis.radii.map((r) => (
                    <td key={r.radiusKm} className={`num px-2 py-1.5 text-right ${r.byKind[kind.id] ? "text-white" : "text-ink-500"}`}>
                      {r.byKind[kind.id]}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-white/[0.02] font-medium">
                <td className="px-2.5 py-1.5 text-ink-100">Emergency services</td>
                {analysis.radii.map((r) => (
                  <td key={r.radiusKm} className="num px-2 py-1.5 text-right text-white">
                    {r.emergency}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-1.5 text-[10.5px] text-ink-500">Emergency services = fire, ambulance and police stations.</p>
      </Section>

      <Section title="Nearest mapped facilities">
        <div className="space-y-2">
          <NearestCard
            facility={analysis.nearestHospital}
            label="Hospital"
            icon={<Hospital className="h-4 w-4" />}
            color={FACILITY_COLORS.hospital}
            routing={routing}
            onFocus={props.onFocusFacility}
          />
          <NearestCard
            facility={analysis.nearestFireStation}
            label="Fire station"
            icon={<Flame className="h-4 w-4" />}
            color={FACILITY_COLORS.emergency}
            routing={routing}
            onFocus={props.onFocusFacility}
          />
        </div>
        {!routing.enabled && (
          <p className="mt-2 text-[10.5px] leading-relaxed text-ink-500">
            Driving routes are optional: enable Amazon Location routing (<code className="text-ink-300">VITE_AWS_LOCATION_ENABLE_ROUTING</code>)
            to compare straight-line distance with road distance and estimated drive time.
          </p>
        )}
      </Section>

      <Section title="Facility distribution by radius">
        <div className="h-[150px]" role="img" aria-label="Grouped bar chart of health facilities and emergency services within each radius">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 6, right: 4, bottom: 0, left: -18 }} barGap={2}>
              <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.08)" />
              <XAxis dataKey="radius" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "rgba(148,163,184,0.15)" }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
              <Tooltip cursor={{ fill: "rgba(148,163,184,0.06)" }} content={<ChartTooltip formatLabel={(l) => `Within ${l}`} unit="facilities" />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "#cbd5e1" }} />
              <Bar dataKey="Health" name="Hospitals + clinics" fill={FACILITY_COLORS.hospital} radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Bar dataKey="Emergency" name="Emergency services" fill={FACILITY_COLORS.emergency} radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title="Population exposure (estimate)">
        <PopulationExposure state={props.population} onRetry={props.onRetryPopulation} />
      </Section>
    </div>
  );
}
