import { AlertTriangle, Cloud, Map as MapIcon, Menu, RefreshCw, Satellite } from "lucide-react";
import { FEEDS } from "../config/constants";
import type { FeedStatus } from "../hooks/useEarthquakes";
import type { ResolvedMapStyle } from "../services/mapStyle";
import type { DataSource, TimeRange } from "../types/earthquake";
import { formatClock, formatDateTime, formatRelative } from "../utils/format";
import { Logo } from "./Logo";
import { Spinner } from "./ui/Spinner";

interface HeaderProps {
  status: FeedStatus;
  lastUpdated: number | null;
  timeRange: TimeRange;
  mapStyle: ResolvedMapStyle | null;
  source: DataSource | null;
  fallbackReason: string | null;
  now: number;
  onRefresh: () => void;
  onOpenMenu: () => void;
}

const STATUS_META: Record<FeedStatus, { label: string; dot: string; text: string }> = {
  ready: { label: "Live", dot: "bg-emerald-400", text: "text-emerald-300" },
  refreshing: { label: "Syncing", dot: "bg-sky-400", text: "text-sky-300" },
  loading: { label: "Connecting", dot: "bg-amber-400", text: "text-amber-300" },
  error: { label: "Feed error", dot: "bg-rose-500", text: "text-rose-300" },
};

export const SOURCE_META: Record<DataSource, { label: string; short: string; detail: string; className: string }> = {
  "aws-api": {
    label: "AWS API",
    short: "AWS",
    detail: "Served by the GeoRescue AWS pipeline (EventBridge → Lambda → S3 → API Gateway)",
    className: "border-orange-300/25 bg-orange-300/[0.07] text-orange-200",
  },
  "usgs-direct": {
    label: "USGS direct",
    short: "USGS",
    detail: "Loaded directly from the USGS GeoJSON feed",
    className: "border-white/[0.07] bg-white/[0.03] text-ink-300",
  },
  "usgs-fallback": {
    label: "USGS fallback",
    short: "USGS*",
    detail: "AWS API unavailable — loaded directly from the USGS GeoJSON feed",
    className: "border-amber-300/30 bg-amber-300/[0.08] text-amber-200",
  },
};

export function Header({ status, lastUpdated, timeRange, mapStyle, source, fallbackReason, now, onRefresh, onOpenMenu }: HeaderProps) {
  const sourceMeta = source ? SOURCE_META[source] : null;
  const meta = STATUS_META[status];
  const busy = status === "loading" || status === "refreshing";

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-ink-950/95 px-3 backdrop-blur sm:px-4">
      <button
        type="button"
        onClick={onOpenMenu}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-300 hover:bg-white/[0.06] hover:text-ink-100 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex min-w-0 items-center gap-2.5">
        <Logo className="h-8 w-8 shrink-0" />
        <div className="min-w-0 leading-tight">
          <h1 className="font-display text-[17px] font-semibold tracking-tight text-white">
            Geo<span className="text-sky-400">Rescue</span>
          </h1>
          <p className="hidden truncate text-[11px] text-ink-400 sm:block">Disaster Intelligence Platform</p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {sourceMeta && source && (
          <span
            className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium lg:inline-flex ${sourceMeta.className}`}
            title={fallbackReason ? `${sourceMeta.detail}. Reason: ${fallbackReason}` : sourceMeta.detail}
          >
            {source === "aws-api" ? <Cloud className="h-3.5 w-3.5" /> : source === "usgs-fallback" ? <AlertTriangle className="h-3.5 w-3.5" /> : <Satellite className="h-3.5 w-3.5" />}
            Data: {sourceMeta.label}
          </span>
        )}

        {mapStyle && (
          <span
            className="hidden items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[11px] text-ink-300 xl:inline-flex"
            title={mapStyle.label}
          >
            <MapIcon className="h-3.5 w-3.5 text-ink-400" />
            {mapStyle.provider === "amazon-location" ? "Amazon Location" : "Open basemap"}
          </span>
        )}

        <div
          className="flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] py-1 pl-2.5 pr-3"
          role="status"
          aria-live="polite"
        >
          <span className="relative flex h-2 w-2">
            {status === "ready" && <span className={`absolute inset-0 rounded-full ${meta.dot} animate-pulse-ring`} />}
            <span className={`relative h-2 w-2 rounded-full ${meta.dot}`} />
          </span>
          <span className={`text-xs font-medium ${meta.text}`}>{meta.label}</span>
          <span className="hidden text-[11px] text-ink-400 sm:inline" title={sourceMeta?.detail}>
            {sourceMeta?.short ?? "USGS"} · {FEEDS[timeRange].short}
          </span>
        </div>

        <div className="hidden text-right leading-tight md:block" title={lastUpdated ? formatDateTime(lastUpdated) : undefined}>
          <p className="label-xs !text-[9.5px]">Last updated</p>
          <p className="num text-xs text-ink-200">
            {lastUpdated ? (
              <>
                {formatClock(lastUpdated)} <span className="text-ink-400">· {formatRelative(lastUpdated, now)}</span>
              </>
            ) : status === "error" ? (
              <span className="inline-flex items-center gap-1 text-rose-300">
                <AlertTriangle className="h-3 w-3" /> unavailable
              </span>
            ) : (
              "—"
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={busy}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm font-medium text-ink-100 transition-colors hover:border-sky-400/40 hover:bg-sky-400/10 disabled:cursor-wait disabled:opacity-60"
          aria-label="Refresh earthquake data"
        >
          {busy ? <Spinner className="h-4 w-4 text-sky-300" /> : <RefreshCw className="h-4 w-4" />}
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </header>
  );
}
