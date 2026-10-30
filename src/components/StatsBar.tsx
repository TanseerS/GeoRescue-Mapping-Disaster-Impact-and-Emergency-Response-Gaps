import { Activity, Building2, Gauge, Siren, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { SEVERITY_BY_ID, SIGNIFICANT_MAGNITUDE } from "../config/constants";
import type { Earthquake } from "../types/earthquake";
import { formatMagnitude, formatNumber } from "../utils/format";
import type { EarthquakeStats } from "../utils/stats";

interface StatCardProps {
  label: string;
  value: ReactNode;
  detail: ReactNode;
  icon: ReactNode;
  accent: string;
  loading?: boolean;
  onClick?: () => void;
  title?: string;
  className?: string;
}

function StatCard({ label, value, detail, icon, accent, loading, onClick, title, className = "" }: StatCardProps) {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={title}
      className={`panel group relative min-w-0 overflow-hidden px-3.5 py-3 text-left ${className} ${
        onClick ? "transition-colors hover:border-white/[0.14] hover:bg-ink-850" : ""
      }`}
    >
      <span className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full opacity-20 blur-2xl" style={{ backgroundColor: accent }} />
      <div className="flex items-center justify-between gap-2">
        <p className="label-xs truncate">{label}</p>
        <span className="shrink-0" style={{ color: accent }}>
          {icon}
        </span>
      </div>
      {loading ? (
        <div className="mt-2 h-7 w-20 animate-pulse rounded bg-white/[0.06]" />
      ) : (
        <p className="num mt-1.5 truncate text-[22px] font-semibold leading-7 text-white">{value}</p>
      )}
      <p className="mt-0.5 truncate text-[11px] text-ink-400">{detail}</p>
    </Component>
  );
}

interface StatsBarProps {
  stats: EarthquakeStats;
  loading: boolean;
  facilityCount: number;
  hospitalCount: number;
  analyzedAreas: number;
  onSelectStrongest: (quake: Earthquake) => void;
}

export function StatsBar({ stats, loading, facilityCount, hospitalCount, analyzedAreas, onSelectStrongest }: StatsBarProps) {
  const strongest = stats.strongest;
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-3 min-[1440px]:grid-cols-5">
      <StatCard
        label="Earthquakes"
        value={formatNumber(stats.total)}
        detail="Matching filters"
        icon={<Activity className="h-4 w-4" />}
        accent="#38bdf8"
        loading={loading}
      />
      <StatCard
        label="Significant"
        value={formatNumber(stats.significant)}
        detail={`M ${SIGNIFICANT_MAGNITUDE}+ events`}
        icon={<TrendingUp className="h-4 w-4" />}
        accent={SEVERITY_BY_ID.moderate.color}
        loading={loading}
      />
      <StatCard
        label="Avg magnitude"
        value={stats.averageMagnitude === null ? "—" : formatMagnitude(stats.averageMagnitude)}
        detail={stats.maxMagnitude === null ? "No events" : `Peak M ${formatMagnitude(stats.maxMagnitude)}`}
        icon={<Gauge className="h-4 w-4" />}
        accent={SEVERITY_BY_ID.light.color}
        loading={loading}
      />
      <StatCard
        label="Facilities"
        value={formatNumber(facilityCount)}
        detail={
          analyzedAreas === 0
            ? "Select an event to map"
            : `${formatNumber(hospitalCount)} hospitals · ${analyzedAreas} area${analyzedAreas === 1 ? "" : "s"}`
        }
        icon={<Building2 className="h-4 w-4" />}
        accent="#8b5cf6"
      />
      <StatCard
        label="Strongest"
        value={strongest ? `M ${formatMagnitude(strongest.magnitude)}` : "—"}
        detail={strongest ? strongest.place : "No events"}
        icon={<Siren className="h-4 w-4" />}
        accent={strongest ? SEVERITY_BY_ID[strongest.severity].color : "#8a99b0"}
        loading={loading}
        onClick={strongest ? () => onSelectStrongest(strongest) : undefined}
        className="col-span-2 sm:col-span-1"
        title={strongest ? `Select strongest event: ${strongest.place}` : undefined}
      />
    </div>
  );
}
