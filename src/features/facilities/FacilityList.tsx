import { ExternalLink, Flame, Hospital, ShieldCheck, Truck } from "lucide-react";
import type { ReactNode } from "react";
import { FACILITY_COLORS } from "../../config/constants";
import type { FacilityKind, FacilityWithDistance } from "../../types/facility";
import { formatDistance } from "../../utils/format";

export const FACILITY_KIND_META: Record<FacilityKind, { label: string; icon: ReactNode }> = {
  hospital: { label: "Hospital", icon: <Hospital className="h-3.5 w-3.5" /> },
  fire_station: { label: "Fire station", icon: <Flame className="h-3.5 w-3.5" /> },
  police: { label: "Police", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  ambulance_station: { label: "Ambulance", icon: <Truck className="h-3.5 w-3.5" /> },
};

interface FacilityListProps {
  facilities: FacilityWithDistance[];
  limit?: number;
  onFocus: (facility: FacilityWithDistance) => void;
}

export function FacilityList({ facilities, limit, onFocus }: FacilityListProps) {
  const shown = limit ? facilities.slice(0, limit) : facilities;
  return (
    <ul className="space-y-1">
      {shown.map((f) => {
        const meta = FACILITY_KIND_META[f.kind];
        const color = f.category === "hospital" ? FACILITY_COLORS.hospital : FACILITY_COLORS.emergency;
        return (
          <li key={f.id} className="group flex items-center gap-1 rounded-lg transition-colors hover:bg-white/[0.04]">
            <button
              type="button"
              onClick={() => onFocus(f)}
              className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-1.5 text-left"
              title={`Show ${f.name} on map`}
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                style={{ color, backgroundColor: `${color}1a` }}
              >
                {meta.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-ink-100">{f.name}</span>
                <span className="block text-[11px] text-ink-400">
                  {meta.label}
                  {f.hasEmergencyDept && " · Emergency dept."}
                </span>
              </span>
              <span className="num shrink-0 text-xs font-medium text-ink-200">{formatDistance(f.distanceKm)}</span>
            </button>
            <a
              href={f.osmUrl}
              target="_blank"
              rel="noreferrer"
              className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-500 opacity-0 transition-opacity hover:text-ink-100 focus:opacity-100 group-hover:opacity-100"
              aria-label={`Open ${f.name} on OpenStreetMap`}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
