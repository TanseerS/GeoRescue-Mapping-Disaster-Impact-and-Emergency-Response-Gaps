import { AlertOctagon, AlertTriangle, CheckCircle2, Hospital, Info, Navigation, ShieldAlert, Siren } from "lucide-react";
import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "../../components/ChartTooltip";
import { EmptyState } from "../../components/ui/EmptyState";
import { PanelHeader, Section } from "../../components/ui/PanelHeader";
import { MagnitudeChip } from "../../components/ui/SeverityBadge";
import { ANALYSIS_RADII_KM, FACILITY_COLORS, SEVERITY_BY_ID } from "../../config/constants";
import type { GapAnalysis, ProximityRating } from "../../types/analysis";
import type { Earthquake } from "../../types/earthquake";
import type { FacilityResult, FacilityWithDistance } from "../../types/facility";
import { formatDistance, formatMagnitude } from "../../utils/format";
import { FacilityStatus } from "../facilities/FacilityStatus";

const RATING_META: Record<ProximityRating, { label: string; detail: string; color: string; icon: ReactNode }> = {
  good: {
    label: "Hospital within 10 km",
    detail: "At least one mapped hospital is close to the epicenter.",
    color: SEVERITY_BY_ID.minor.color,
    icon: <CheckCircle2 className="h-5 w-5" />,
  },
  moderate: {
    label: "Nearest hospital 10–25 km",
    detail: "Mapped hospital access exists but is not immediate.",
    color: SEVERITY_BY_ID.light.color,
    icon: <Info className="h-5 w-5" />,
  },
  limited: {
    label: "Nearest hospital 25–50 km",
    detail: "Limited mapped hospital access near the epicenter.",
    color: SEVERITY_BY_ID.moderate.color,
    icon: <AlertTriangle className="h-5 w-5" />,
  },
  critical: {
    label: "No mapped hospital within 50 km",
    detail: "Potential response gap — prioritize for further investigation.",
    color: SEVERITY_BY_ID.strong.color,
    icon: <AlertOctagon className="h-5 w-5" />,
  },
};

interface GapAnalysisPanelProps {
  candidates: Earthquake[];
  selected: Earthquake | null;
  result: FacilityResult | undefined;
  analysis: GapAnalysis | null;
  onSelect: (id: string) => void;
  onRetry: () => void;
  onFocusFacility: (facility: FacilityWithDistance) => void;
}

export function GapAnalysisPanel({ candidates, selected, result, analysis, onSelect, onRetry, onFocusFacility }: GapAnalysisPanelProps) {
  const options = [...candidates].sort((a, b) => b.magnitude - a.magnitude).slice(0, 300);
  if (selected && !options.some((o) => o.id === selected.id)) options.unshift(selected);

  return (
    <div className="flex h-full flex-col">
      <PanelHeader kicker="Turf.js proximity model" title="Response Gap Analysis" />

      <div className="border-b border-white/[0.06] px-4 py-3">
        <label htmlFor="gap-quake" className="mb-1.5 block text-xs text-ink-300">
          Earthquake to analyze
        </label>
        <select
          id="gap-quake"
          value={selected?.id ?? ""}
          onChange={(e) => e.target.value && onSelect(e.target.value)}
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
              description="GeoRescue counts mapped hospitals and emergency facilities within 10, 25 and 50 km of the epicenter and finds the nearest hospital."
            />
            {options.length > 0 && (
              <Section title="Quick picks · strongest events">
                <ul className="space-y-0.5">
                  {options.slice(0, 5).map((q) => (
                    <li key={q.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(q.id)}
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
        ) : result?.status !== "success" || !analysis ? (
          <div className="p-4">
            <FacilityStatus result={result} onRetry={onRetry} />
          </div>
        ) : (
          <AnalysisResult analysis={analysis} onFocusFacility={onFocusFacility} />
        )}

        <div className="mx-4 mb-4 mt-1 rounded-lg border border-amber-300/15 bg-amber-300/[0.04] px-3 py-2.5 text-[11px] leading-relaxed text-amber-100/80">
          <p className="mb-0.5 flex items-center gap-1.5 font-semibold text-amber-200">
            <Info className="h-3.5 w-3.5" /> Proximity is an estimate
          </p>
          Distances are straight-line (great-circle) measurements to facilities mapped in OpenStreetMap. They do not reflect
          road access, travel time, hospital capacity, staffing, damage or real-time availability, and OSM coverage is
          incomplete in many regions. Use these results only to prioritize further investigation.
        </div>
      </div>
    </div>
  );
}

function AnalysisResult({ analysis, onFocusFacility }: { analysis: GapAnalysis; onFocusFacility: (f: FacilityWithDistance) => void }) {
  const rating = RATING_META[analysis.rating];
  const chartData = analysis.radii.map((r) => ({ radius: `${r.radiusKm} km`, Hospitals: r.hospitals, Emergency: r.emergency }));

  return (
    <div className="animate-fade-in">
      <div className="px-4 pt-4">
        <div
          className="flex items-start gap-3 rounded-xl border px-3.5 py-3"
          style={{ borderColor: `${rating.color}40`, backgroundColor: `${rating.color}0f` }}
          role="status"
        >
          <span style={{ color: rating.color }}>{rating.icon}</span>
          <div>
            <p className="text-sm font-semibold text-white">{rating.label}</p>
            <p className="mt-0.5 text-xs text-ink-300">{rating.detail}</p>
          </div>
        </div>
      </div>

      <Section title="Hospitals within radius">
        <div className="grid grid-cols-3 gap-2">
          {analysis.radii.map((r) => (
            <div key={r.radiusKm} className="panel-muted px-2.5 py-2.5 text-center">
              <p className="num text-2xl font-semibold" style={{ color: r.hospitals > 0 ? FACILITY_COLORS.hospital : "#64748b" }}>
                {r.hospitals}
              </p>
              <p className="text-[11px] text-ink-400">≤ {r.radiusKm} km</p>
              <p className="mt-1 text-[10.5px] text-ink-500">+{r.emergency} emergency</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Nearest mapped hospital">
        {analysis.nearestHospital ? (
          <button
            type="button"
            onClick={() => onFocusFacility(analysis.nearestHospital!)}
            className="flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-left transition-colors hover:border-sky-400/30"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-400/10 text-sky-300">
              <Hospital className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-white">{analysis.nearestHospital.name}</span>
              <span className="flex items-center gap-1 text-[11px] text-ink-400">
                <Navigation className="h-3 w-3" /> Show on map
              </span>
            </span>
            <span className="text-right">
              <span className="num block text-lg font-semibold text-white">{formatDistance(analysis.nearestHospital.distanceKm)}</span>
              <span className="text-[10.5px] text-ink-500">straight-line</span>
            </span>
          </button>
        ) : (
          <p className="rounded-xl border border-dashed border-rose-500/30 px-3 py-3 text-xs text-rose-200/90">
            No hospital is mapped within {Math.max(...ANALYSIS_RADII_KM)} km of this epicenter.
          </p>
        )}
        {analysis.nearestEmergency && (
          <button
            type="button"
            onClick={() => onFocusFacility(analysis.nearestEmergency!)}
            className="mt-2 flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left text-xs text-ink-300 hover:text-white"
          >
            <Siren className="h-3.5 w-3.5 text-violet-300" />
            <span className="min-w-0 flex-1 truncate">Nearest emergency facility: {analysis.nearestEmergency.name}</span>
            <span className="num shrink-0">{formatDistance(analysis.nearestEmergency.distanceKm)}</span>
          </button>
        )}
      </Section>

      <Section title="Facilities by distance band">
        <div className="h-[150px]" role="img" aria-label="Grouped bar chart of hospitals and emergency facilities within 10, 25 and 50 km">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 6, right: 4, bottom: 0, left: -18 }} barGap={2}>
              <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.08)" />
              <XAxis dataKey="radius" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "rgba(148,163,184,0.15)" }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
              <Tooltip cursor={{ fill: "rgba(148,163,184,0.06)" }} content={<ChartTooltip formatLabel={(l) => `Within ${l}`} />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "#cbd5e1" }} />
              <Bar dataKey="Hospitals" fill={FACILITY_COLORS.hospital} radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Bar dataKey="Emergency" fill={FACILITY_COLORS.emergency} radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>
    </div>
  );
}
