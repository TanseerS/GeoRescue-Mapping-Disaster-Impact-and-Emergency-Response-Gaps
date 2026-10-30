import { ExternalLink, Route, X } from "lucide-react";
import { IconButton } from "../../components/ui/Button";
import { Spinner } from "../../components/ui/Spinner";
import { FACILITY_KIND_BY_ID } from "../../config/constants";
import type { RouteState } from "../../hooks/useRoute";
import type { Earthquake } from "../../types/earthquake";
import type { Facility } from "../../types/facility";
import { formatDistance } from "../../utils/format";
import { distanceKm } from "../../utils/geo";
import { FACILITY_KIND_META } from "./FacilityList";

interface FacilityCardProps {
  facility: Facility;
  selected: Earthquake | null;
  routing: { enabled: boolean; state: RouteState; request: (f: Facility) => void; clear: () => void };
  onClose: () => void;
}

const DETAIL_LABELS: [keyof Facility["details"], string][] = [
  ["operator", "Operator"],
  ["address", "Address"],
  ["phone", "Phone"],
  ["beds", "Beds (OSM)"],
  ["openingHours", "Hours"],
  ["speciality", "Speciality"],
];

/** Details of a facility selected on the map. Only OpenStreetMap tags that exist are shown. */
export function FacilityCard({ facility, selected, routing, onClose }: FacilityCardProps) {
  const kind = FACILITY_KIND_BY_ID[facility.kind];
  const straight = selected ? distanceKm(selected, facility) : null;
  const route = routing.state.status !== "idle" && routing.state.facilityId === facility.id ? routing.state : null;
  const rows = DETAIL_LABELS.filter(([key]) => facility.details?.[key]);

  return (
    <div className="pointer-events-auto w-[290px] max-w-[calc(100vw-48px)] rounded-xl border border-white/[0.1] bg-ink-950/95 shadow-panel backdrop-blur animate-fade-in" role="dialog" aria-label={`${facility.name} details`}>
      <div className="flex items-start gap-2.5 border-b border-white/[0.06] px-3 py-2.5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ color: kind.color, backgroundColor: `${kind.color}1f` }}>
          {FACILITY_KIND_META[facility.kind].icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] uppercase tracking-wider" style={{ color: kind.color }}>
            {kind.label}
            {facility.hasEmergencyDept && " · emergency dept."}
          </p>
          <p className="text-sm font-semibold leading-snug text-white">{facility.name}</p>
        </div>
        <IconButton label="Close facility details" onClick={onClose} className="-mr-1 -mt-0.5">
          <X className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="space-y-2 px-3 py-2.5 text-xs">
        {straight !== null && (
          <p className="text-ink-300">
            <span className="num font-semibold text-white">{formatDistance(straight)}</span> straight-line from the selected epicenter
          </p>
        )}
        {rows.length > 0 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {rows.map(([key, label]) => (
              <div key={key} className="contents">
                <dt className="text-ink-500">{label}</dt>
                <dd className="break-words text-ink-200">{facility.details[key]}</dd>
              </div>
            ))}
          </dl>
        )}

        {selected && routing.enabled && (
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
            {route?.status === "success" ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-ink-200">
                  <span className="num font-semibold text-white">{(route.result.distanceMeters / 1000).toFixed(1)} km</span> ·{" "}
                  <span className="num font-semibold text-white">{Math.round(route.result.durationSeconds / 60)} min</span> by road
                  <span className="block text-[10.5px] text-ink-500">Amazon Location estimate, typical traffic</span>
                </p>
                <button type="button" onClick={routing.clear} className="shrink-0 text-[11px] text-ink-400 hover:text-white">
                  Clear
                </button>
              </div>
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
                Driving route to epicenter
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-0.5">
          <a href={facility.osmUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200">
            OpenStreetMap <ExternalLink className="h-3 w-3" />
          </a>
          {facility.details.website && /^https?:\/\//.test(facility.details.website) && (
            <a href={facility.details.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200">
              Website <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
