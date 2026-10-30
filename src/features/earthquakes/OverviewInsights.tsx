import { ArrowRight, MousePointerClick, Radar } from "lucide-react";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "../../components/ChartTooltip";
import { Section } from "../../components/ui/PanelHeader";
import { MagnitudeChip, SeverityBadge } from "../../components/ui/SeverityBadge";
import { FEEDS, SEVERITY_BY_ID } from "../../config/constants";
import type { Earthquake, EarthquakeFeed, TimeRange } from "../../types/earthquake";
import { formatNumber, formatRelative } from "../../utils/format";
import { eventTimeline, magnitudeHistogram, topRegions, type EarthquakeStats } from "../../utils/stats";

interface OverviewInsightsProps {
  earthquakes: Earthquake[];
  stats: EarthquakeStats;
  feed: EarthquakeFeed | null;
  timeRange: TimeRange;
  now: number;
  onSelect: (id: string) => void;
}

const AXIS_TICK = { fill: "#64748b", fontSize: 10 };

export function OverviewInsights({ earthquakes, stats, feed, timeRange, now, onSelect }: OverviewInsightsProps) {
  const histogram = useMemo(() => magnitudeHistogram(earthquakes), [earthquakes]);
  const timeline = useMemo(() => eventTimeline(earthquakes, timeRange, now), [earthquakes, timeRange, now]);
  const regions = useMemo(() => topRegions(earthquakes, 5), [earthquakes]);
  const notable = useMemo(
    () => [...earthquakes].sort((a, b) => b.magnitude - a.magnitude).slice(0, 5),
    [earthquakes],
  );
  const strongest = stats.strongest;

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

      <Section title="Magnitude distribution" aside={<span className="text-[10.5px] text-ink-500">events per magnitude unit</span>}>
        {histogram.length === 0 ? (
          <p className="text-xs text-ink-400">No events in the current selection.</p>
        ) : (
          <div className="h-[140px]" role="img" aria-label="Bar chart of earthquake counts by magnitude">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogram} margin={{ top: 6, right: 4, bottom: 0, left: -18 }} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.08)" />
                <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "rgba(148,163,184,0.15)" }} tickFormatter={(v) => `M${v}`} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
                <Tooltip
                  cursor={{ fill: "rgba(148,163,184,0.06)" }}
                  content={<ChartTooltip formatLabel={(l) => `Magnitude ${l}.0 – ${l}.9`} />}
                />
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

      <Section title="Most active regions">
        <ul className="space-y-1.5">
          {regions.map((r) => {
            const pct = stats.total ? (r.count / stats.total) * 100 : 0;
            return (
              <li key={r.region} className="text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-ink-200">{r.region}</span>
                  <span className="num shrink-0 text-ink-300">
                    {formatNumber(r.count)} <span className="text-ink-500">· max M{r.maxMag.toFixed(1)}</span>
                  </span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                  <div className="h-full rounded-full bg-sky-400/70" style={{ width: `${Math.max(pct, 2)}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Strongest events">
        <ul className="space-y-0.5">
          {notable.map((q) => (
            <li key={q.id}>
              <button
                type="button"
                onClick={() => onSelect(q.id)}
                className="flex w-full items-center gap-3 rounded-lg px-1.5 py-1.5 text-left hover:bg-white/[0.04]"
              >
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
        Statistics reflect the active filters.
      </p>
    </div>
  );
}
