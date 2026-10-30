import { ArrowRight, Focus, MousePointerClick, Radar } from "lucide-react";
import { memo, useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "../../components/ChartTooltip";
import { Section } from "../../components/ui/PanelHeader";
import { MagnitudeChip, SeverityBadge } from "../../components/ui/SeverityBadge";
import { DEPTH_CLASSES, FACILITY_COLORS, FEEDS, SEVERITY_BY_ID } from "../../config/constants";
import type { Earthquake, EarthquakeFeed, TimeRange } from "../../types/earthquake";
import type { Facility } from "../../types/facility";
import { formatNumber, formatRelative } from "../../utils/format";
import {
  depthHistogram,
  eventTimeline,
  facilityDistribution,
  magnitudeCategories,
  magnitudeHistogram,
  topRegions,
  type EarthquakeStats,
} from "../../utils/stats";

interface OverviewInsightsProps {
  earthquakes: Earthquake[];
  stats: EarthquakeStats;
  feed: EarthquakeFeed | null;
  timeRange: TimeRange;
  now: number;
  facilities: Facility[];
  onSelect: (id: string) => void;
  onFocusRegion: (region: string) => void;
}

const AXIS_TICK = { fill: "#64748b", fontSize: 10 };
const DEPTH_COLOR = Object.fromEntries(DEPTH_CLASSES.map((d) => [d.id, d.color])) as Record<string, string>;

function OverviewInsightsImpl({ earthquakes, stats, feed, timeRange, now, facilities, onSelect, onFocusRegion }: OverviewInsightsProps) {
  const histogram = useMemo(() => magnitudeHistogram(earthquakes), [earthquakes]);
  const categories = useMemo(() => magnitudeCategories(earthquakes), [earthquakes]);
  const depths = useMemo(() => depthHistogram(earthquakes), [earthquakes]);
  const timeline = useMemo(() => eventTimeline(earthquakes, timeRange, now), [earthquakes, timeRange, now]);
  const regions = useMemo(() => topRegions(earthquakes, 6), [earthquakes]);
  const facilityMix = useMemo(() => facilityDistribution(facilities), [facilities]);
  const notable = useMemo(() => [...earthquakes].sort((a, b) => b.magnitude - a.magnitude).slice(0, 5), [earthquakes]);
  const strongest = stats.strongest;
  const facilityTotal = facilities.length;

  if (!feed) {
    return (
      <div className="space-y-3 p-4" aria-busy="true">
        {[120, 140, 160].map((h) => (
          <div key={h} className="animate-pulse rounded-xl bg-white/[0.04]" style={{ height: h }} />
        ))}
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {strongest ? (
        <div className="px-4 pt-4">
          <button
            type="button"
            onClick={() => onSelect(strongest.id)}
            className="group relative w-full overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-br from-ink-800 to-ink-900 p-3.5 text-left transition-colors hover:border-white/[0.16]"
          >
            <span
              className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full opacity-30 blur-3xl"
              style={{ backgroundColor: SEVERITY_BY_ID[strongest.severity].color }}
            />
            <div className="relative flex items-center gap-1.5">
              <Radar className="h-3.5 w-3.5 text-sky-300" />
              <span className="label-xs !text-sky-200/80">Spotlight · strongest event</span>
            </div>
            <div className="relative mt-2 flex items-center gap-3">
              <MagnitudeChip magnitude={strongest.magnitude} level={strongest.severity} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{strongest.place}</p>
                <p className="text-[11px] text-ink-400">
                  {formatRelative(strongest.time, now)} · {strongest.depthKm.toFixed(0)} km deep
                </p>
              </div>
            </div>
            <span className="relative mt-3 inline-flex items-center gap-1 text-xs font-medium text-sky-300 group-hover:text-sky-200">
              Analyze response coverage <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
          <p className="mt-2 flex items-center gap-1.5 px-1 text-[11px] text-ink-500">
            <MousePointerClick className="h-3 w-3" /> Click any marker on the map to inspect it.
          </p>
        </div>
      ) : null}

      <Section title="Magnitude categories">
        {stats.total === 0 ? (
          <p className="text-xs text-ink-400">No events in the current selection.</p>
        ) : (
          <>
            <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Share of events per magnitude category">
              {categories
                .filter((c) => c.count > 0)
                .map((c) => (
                  <span key={c.id} style={{ width: `${(c.count / stats.total) * 100}%`, backgroundColor: c.color, minWidth: 3 }} title={`${c.label}: ${c.count}`} />
                ))}
            </div>
            <ul className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="flex-1 truncate text-ink-300">
                    {c.label} <span className="text-ink-500">M {c.range}</span>
                  </span>
                  <span className="num text-ink-100">{formatNumber(c.count)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section title="Magnitude distribution" aside={<span className="text-[10.5px] text-ink-500">events per magnitude unit</span>}>
        {histogram.length === 0 ? (
          <p className="text-xs text-ink-400">No events in the current selection.</p>
        ) : (
          <div className="h-[130px]" role="img" aria-label="Bar chart of earthquake counts by magnitude">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogram} margin={{ top: 6, right: 4, bottom: 0, left: -18 }} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.08)" />
                <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "rgba(148,163,184,0.15)" }} tickFormatter={(v) => `M${v}`} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
                <Tooltip cursor={{ fill: "rgba(148,163,184,0.06)" }} content={<ChartTooltip formatLabel={(l) => `Magnitude ${l}.0 – ${l}.9`} />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={28}>
                  {histogram.map((bin) => (
                    <Cell key={bin.label} fill={SEVERITY_BY_ID[bin.severity].color} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      <Section title="Earthquakes by depth" aside={<span className="text-[10.5px] text-ink-500">focal depth, km</span>}>
        <div className="h-[120px]" role="img" aria-label="Bar chart of earthquake counts by focal depth">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={depths} margin={{ top: 6, right: 4, bottom: 0, left: -18 }} barCategoryGap={2}>
              <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.08)" />
              <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "rgba(148,163,184,0.15)" }} interval={0} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
              <Tooltip cursor={{ fill: "rgba(148,163,184,0.06)" }} content={<ChartTooltip formatLabel={(l) => `Depth ${l} km`} />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={30}>
                {depths.map((bin) => (
                  <Cell key={bin.label} fill={DEPTH_COLOR[bin.depthClass]} fillOpacity={0.9} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] text-ink-400">
          {DEPTH_CLASSES.map((d) => (
            <span key={d.id} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: d.color }} /> {d.label} {d.range}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Activity over time" aside={<span className="text-[10.5px] text-ink-500">{FEEDS[timeRange].label}</span>}>
        <div className="h-[120px]" role="img" aria-label="Bar chart of earthquake counts over time">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeline} margin={{ top: 6, right: 4, bottom: 0, left: -18 }} barCategoryGap={2}>
              <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.08)" />
              <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "rgba(148,163,184,0.15)" }} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
              <Tooltip cursor={{ fill: "rgba(148,163,184,0.06)" }} content={<ChartTooltip />} />
              <Bar dataKey="count" fill="#38bdf8" fillOpacity={0.8} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title="Most active regions" aside={<span className="text-[10.5px] text-ink-500">click to zoom</span>}>
        <ul className="space-y-0.5">
          {regions.map((r) => {
            const pct = stats.total ? (r.count / stats.total) * 100 : 0;
            return (
              <li key={r.region}>
                <button
                  type="button"
                  onClick={() => onFocusRegion(r.region)}
                  className="group w-full rounded-md px-1.5 py-1 text-left text-xs hover:bg-white/[0.04]"
                  title={`Zoom the map to ${r.region}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1 truncate text-ink-200">
                      {r.region}
                      <Focus className="h-3 w-3 shrink-0 text-ink-500 opacity-0 group-hover:opacity-100" />
                    </span>
                    <span className="num shrink-0 text-ink-300">
                      {formatNumber(r.count)} <span className="text-ink-500">· max M{r.maxMag.toFixed(1)}</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                    <div className="h-full rounded-full bg-sky-400/70" style={{ width: `${Math.max(pct, 2)}%` }} />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Mapped facilities by type" aside={<span className="text-[10.5px] text-ink-500">analyzed areas</span>}>
        {facilityTotal === 0 ? (
          <p className="text-xs leading-relaxed text-ink-400">
            No facilities loaded yet. Select an earthquake or scan a map area to load OpenStreetMap facilities.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {facilityMix.map((f) => (
              <li key={f.kind} className="text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-ink-200">{f.label}</span>
                  <span className="num text-ink-100">{formatNumber(f.count)}</span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${f.count ? Math.max((f.count / facilityTotal) * 100, 2) : 0}%`,
                      backgroundColor: f.kind === "hospital" || f.kind === "clinic" ? FACILITY_COLORS.hospital : FACILITY_COLORS.emergency,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Strongest events">
        <ul className="space-y-0.5">
          {notable.map((q) => (
            <li key={q.id}>
              <button type="button" onClick={() => onSelect(q.id)} className="flex w-full items-center gap-3 rounded-lg px-1.5 py-1.5 text-left hover:bg-white/[0.04]">
                <MagnitudeChip magnitude={q.magnitude} level={q.severity} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-ink-100">{q.place}</span>
                  <span className="block text-[11px] text-ink-400">{formatRelative(q.time, now)}</span>
                </span>
                <SeverityBadge level={q.severity} />
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <p className="px-4 pb-4 text-[10.5px] leading-relaxed text-ink-500">
        Source: {feed.title}. {feed.skipped > 0 && `${feed.skipped} records without magnitude or coordinates were excluded. `}
        Statistics reflect the active filters; facility counts reflect OpenStreetMap results loaded this session.
      </p>
    </div>
  );
}

export const OverviewInsights = memo(OverviewInsightsImpl);
