import { Crosshair, ExternalLink, Layers3, ShieldAlert, Waves, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button, IconButton } from "../../components/ui/Button";
import { Section } from "../../components/ui/PanelHeader";
import { SeverityBadge } from "../../components/ui/SeverityBadge";
import { FACILITY_COLORS, FACILITY_SEARCH_RADIUS_KM, SEVERITY_BY_ID } from "../../config/constants";
import type { GapAnalysis } from "../../types/analysis";
import type { Earthquake } from "../../types/earthquake";
import type { FacilityResult, FacilityWithDistance } from "../../types/facility";
import { formatCoordinate, formatDateTime, formatMagnitude, formatRelative, formatUtc } from "../../utils/format";
import { FacilityList } from "../facilities/FacilityList";
import { FacilityStatus } from "../facilities/FacilityStatus";
import { IntelligenceSummary } from "../intelligence/IntelligenceSummary";
import type { IntelligenceBrief } from "../../utils/intelligence";

interface EarthquakeDetailsProps {
  quake: Earthquake;
  result: FacilityResult | undefined;
  analysis: GapAnalysis | null;
  now: number;
  onClose: () => void;
  onZoom: () => void;
  onRetryFacilities: () => void;
  onOpenAnalysis: () => void;
  onFocusFacility: (facility: FacilityWithDistance) => void;
  brief: IntelligenceBrief | null;
  selectedFacilityId: string | null;
}

function Metric({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="panel-muted min-w-0 px-3 py-2.5">
      <p className="label-xs !text-[10px]">{label}</p>
      <p className="num mt-1 truncate text-sm font-semibold text-white">{value}</p>
      {sub && <p className="mt-0.5 truncate text-[11px] text-ink-400">{sub}</p>}
    </div>
  );
}

export function EarthquakeDetails(props: EarthquakeDetailsProps) {
  const { quake, result, analysis, now } = props;
  const severity = SEVERITY_BY_ID[quake.severity];
  const within = analysis?.radii[analysis.radii.length - 1];
  const outerKm = within?.radiusKm ?? FACILITY_SEARCH_RADIUS_KM;

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-white/[0.06] px-4 pb-4 pt-3.5">
        <div
          className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full opacity-25 blur-3xl"
          style={{ backgroundColor: severity.color }}
        />
        <div className="relative flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="label-xs">Selected earthquake</span>
          </div>
          <IconButton label="Close selection" onClick={props.onClose} className="-mr-1.5 -mt-1">
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="relative mt-1 flex items-end gap-3">
          <p className="num text-[44px] font-semibold leading-none tracking-tight" style={{ color: severity.color }}>
            {formatMagnitude(quake.magnitude)}
          </p>
          <div className="pb-1">
            <SeverityBadge level={quake.severity} />
            <p className="mt-1 text-[11px] text-ink-400">
              {quake.magnitudeType ? `Magnitude (${quake.magnitudeType})` : "Magnitude"} · {severity.description}
            </p>
          </div>
        </div>
        <p className="relative mt-3 text-[15px] font-medium leading-snug text-white">{quake.place}</p>
        <p className="relative mt-0.5 text-xs text-ink-400">{formatRelative(quake.time, now)}</p>

        {(quake.tsunami || quake.alert) && (
          <div className="relative mt-3 flex flex-wrap gap-1.5">
            {quake.tsunami && (
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-[11px] text-sky-200">
                <Waves className="h-3 w-3" /> Tsunami flag (USGS)
              </span>
            )}
            {quake.alert && (
              <span className="inline-flex items-center gap-1 rounded-full border border-orange-400/30 bg-orange-400/10 px-2 py-0.5 text-[11px] capitalize text-orange-200">
                PAGER alert: {quake.alert}
              </span>
            )}
          </div>
        )}

        <div className="relative mt-3.5 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon={<Crosshair className="h-3.5 w-3.5" />} onClick={props.onZoom}>
            Zoom to event
          </Button>
          <Button size="sm" variant="primary" icon={<ShieldAlert className="h-3.5 w-3.5" />} onClick={props.onOpenAnalysis}>
            Gap analysis
          </Button>
          {quake.url && (
            <a
              href={quake.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-ink-300 hover:bg-white/[0.05] hover:text-white"
            >
              USGS <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {props.brief && <IntelligenceSummary brief={props.brief} />}

      <Section title="Event details">
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Depth" value={`${quake.depthKm.toFixed(1)} km`} sub={quake.depthKm < 70 ? "Shallow focus" : quake.depthKm < 300 ? "Intermediate" : "Deep focus"} />
          <Metric label="Felt reports" value={quake.felt ?? "—"} sub="USGS DYFI responses" />
          <div className="col-span-2">
            <Metric label="Date & time" value={formatDateTime(quake.time)} sub={formatUtc(quake.time)} />
          </div>
          <div className="col-span-2">
            <Metric
              label="Coordinates"
              value={`${formatCoordinate(quake.latitude, "lat")}, ${formatCoordinate(quake.longitude, "lon")}`}
              sub={`${quake.latitude.toFixed(4)}, ${quake.longitude.toFixed(4)} (lat, lon)`}
            />
          </div>
        </div>
      </Section>

      <Section
        title={`Within ${outerKm} km`}
        aside={<span className="text-[10.5px] text-ink-500">OpenStreetMap</span>}
      >
        {result?.status === "success" && analysis ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <CountTile color={FACILITY_COLORS.hospital} label="Hospitals" value={within?.hospitals ?? 0} />
              <CountTile color={FACILITY_COLORS.hospital} label="Clinics" value={within?.clinics ?? 0} />
              <CountTile color={FACILITY_COLORS.emergency} label="Emergency" value={within?.emergency ?? 0} />
            </div>
            <div className="mt-3">
              {analysis.facilities.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/[0.08] px-3 py-4 text-center text-xs text-ink-400">
                  <Layers3 className="mx-auto mb-1.5 h-4 w-4 text-ink-500" />
                  No hospitals, clinics or emergency services are mapped in OpenStreetMap within {outerKm} km of this
                  epicenter.
                </div>
              ) : (
                <>
                  <p className="mb-1.5 text-[11px] text-ink-400">Nearest facilities by straight-line distance</p>
                  <FacilityList facilities={analysis.facilities} limit={8} onFocus={props.onFocusFacility} selectedId={props.selectedFacilityId} />
                  {analysis.facilities.length > 8 && (
                    <p className="mt-2 px-2 text-[11px] text-ink-500">
                      + {analysis.facilities.length - 8} more — see Emergency Facilities
                    </p>
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          <FacilityStatus result={result} onRetry={props.onRetryFacilities} />
        )}
      </Section>
    </div>
  );
}

function CountTile({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="panel-muted px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
        <span className="truncate text-[11px] text-ink-300">{label}</span>
      </div>
      <p className="num mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}
