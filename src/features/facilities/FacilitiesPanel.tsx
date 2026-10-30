import { Building2, Crosshair, Info, Layers, ScanSearch } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { PanelHeader } from "../../components/ui/PanelHeader";
import { FACILITY_KIND_BY_ID, FACILITY_KINDS, FACILITY_SEARCH_RADIUS_KM } from "../../config/constants";
import type { Earthquake } from "../../types/earthquake";
import type { BoundingBox, FacilityKind, FacilityResult, FacilityWithDistance } from "../../types/facility";
import { formatNumber } from "../../utils/format";
import { withDistances } from "../../utils/geo";
import { FACILITY_KIND_META, FacilityList } from "./FacilityList";
import { FacilityStatus } from "./FacilityStatus";

/** Largest viewport (in square degrees) that may be scanned, to keep Overpass queries reasonable. */
export const MAX_SCAN_AREA_SQ_DEG = 1.2;

export function bboxArea(b: BoundingBox): number {
  return Math.abs(b.north - b.south) * Math.abs(b.east - b.west);
}

interface FacilitiesPanelProps {
  selected: Earthquake | null;
  selectedResult: FacilityResult | undefined;
  viewport: { bbox: BoundingBox; zoom: number } | null;
  areaResult: FacilityResult | undefined;
  areaCenter: { latitude: number; longitude: number } | null;
  onScanArea: () => void;
  onRetryArea: () => void;
  onRetrySelected: () => void;
  onFocus: (facility: FacilityWithDistance) => void;
  selectedFacilityId: string | null;
}

type Source = "event" | "area";
type KindFilter = "all" | FacilityKind;

export function FacilitiesPanel(props: FacilitiesPanelProps) {
  const { selected, selectedResult, viewport, areaResult, areaCenter } = props;
  const [source, setSource] = useState<Source>(selected ? "event" : "area");
  const [filter, setFilter] = useState<KindFilter>("all");

  useEffect(() => {
    if (selected) setSource("event");
  }, [selected]);

  const result = source === "event" ? selectedResult : areaResult;
  const origin = source === "event" ? selected : selected ?? areaCenter;

  const facilities = useMemo(() => {
    if (!result || result.status !== "success" || !origin) return [];
    const maxKm = source === "event" ? FACILITY_SEARCH_RADIUS_KM : Infinity;
    return withDistances(origin, result.facilities, maxKm);
  }, [result, origin, source]);

  const byKind = useMemo(() => {
    const counts: Record<FacilityKind, number> = { hospital: 0, clinic: 0, fire_station: 0, ambulance_station: 0, police: 0 };
    facilities.forEach((f) => (counts[f.kind] += 1));
    return counts;
  }, [facilities]);

  const visible = filter === "all" ? facilities : facilities.filter((f) => f.kind === filter);
  const canScan = viewport ? bboxArea(viewport.bbox) <= MAX_SCAN_AREA_SQ_DEG : false;

  return (
    <div className="flex h-full flex-col">
      <PanelHeader kicker="OpenStreetMap · Overpass API" title="Emergency Facilities" />

      <div className="space-y-3 border-b border-white/[0.06] px-4 py-3">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-white/[0.03] p-1" role="tablist" aria-label="Facility source">
          {(
            [
              { id: "event", label: "Around selected event" },
              { id: "area", label: "Visible map area" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={source === opt.id}
              onClick={() => setSource(opt.id)}
              className={`truncate rounded-md px-2 py-1.5 text-xs font-medium ${
                source === opt.id ? "bg-ink-700 text-white shadow" : "text-ink-400 hover:text-ink-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {source === "area" && (
          <div className="space-y-2">
            <Button
              variant="primary"
              size="sm"
              className="w-full"
              icon={<ScanSearch className="h-3.5 w-3.5" />}
              onClick={props.onScanArea}
              disabled={!canScan || areaResult?.status === "loading"}
            >
              Scan visible map area
            </Button>
            {!canScan && (
              <p className="flex items-start gap-1.5 text-[11px] leading-snug text-ink-400">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                Zoom in to a city or region (roughly 100 × 100 km or smaller) to scan for facilities.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {source === "event" && !selected ? (
          <EmptyState
            icon={<Crosshair className="h-5 w-5" />}
            title="No earthquake selected"
            description={`Select an earthquake on the map to load hospitals, clinics and emergency services within ${FACILITY_SEARCH_RADIUS_KM} km.`}
          />
        ) : source === "area" && !areaResult ? (
          <EmptyState
            icon={<Building2 className="h-5 w-5" />}
            title="Scan any area of the map"
            description="Zoom into a region and scan it to map hospitals, fire, police and ambulance stations from OpenStreetMap."
          />
        ) : result?.status !== "success" ? (
          <div className="p-4">
            <FacilityStatus result={result} onRetry={source === "event" ? props.onRetrySelected : props.onRetryArea} />
          </div>
        ) : (
          <div className="animate-fade-in">
            <div className="grid grid-cols-3 gap-1.5 px-4 pt-3" role="radiogroup" aria-label="Filter by facility type">
              {(["all", ...FACILITY_KINDS.map((k) => k.id)] as KindFilter[]).map((kind) => {
                const active = filter === kind;
                const def = kind === "all" ? null : FACILITY_KIND_BY_ID[kind];
                return (
                  <button
                    key={kind}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setFilter(kind)}
                    className={`flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left transition-colors ${
                      active ? "border-sky-400/40 bg-sky-400/10" : "border-white/[0.05] bg-white/[0.02] hover:border-white/[0.12]"
                    }`}
                  >
                    {def ? (
                      <span className="shrink-0" style={{ color: def.color }}>
                        {FACILITY_KIND_META[def.id].icon}
                      </span>
                    ) : (
                      <Layers className="h-3.5 w-3.5 shrink-0 text-ink-300" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-[11px] text-ink-300">{def ? def.plural : "All"}</span>
                    <span className="num text-xs font-semibold text-white">{kind === "all" ? facilities.length : byKind[kind]}</span>
                  </button>
                );
              })}
            </div>

            <p className="px-4 pb-1 pt-3 text-[11px] text-ink-400">
              <span className="num text-ink-200">{formatNumber(visible.length)}</span>{" "}
              {visible.length === 1 ? "facility" : "facilities"} ·{" "}
              {source === "event"
                ? `within ${FACILITY_SEARCH_RADIUS_KM} km of epicenter`
                : selected
                  ? "straight-line distance from epicenter"
                  : "straight-line distance from area center"}
            </p>

            <div className="px-2 pb-4">
              {visible.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-ink-400">
                  No {filter === "all" ? "facilities" : FACILITY_KIND_BY_ID[filter].plural.toLowerCase()} are mapped in this
                  area.
                </p>
              ) : (
                <FacilityList facilities={visible} limit={200} onFocus={props.onFocus} selectedId={props.selectedFacilityId} />
              )}
              {visible.length > 200 && <p className="px-2 pt-2 text-[11px] text-ink-500">Showing the nearest 200.</p>}
            </div>
          </div>
        )}
      </div>

      <p className="border-t border-white/[0.06] px-4 py-2.5 text-[10.5px] leading-relaxed text-ink-500">
        Facility data © OpenStreetMap contributors. Coverage varies by region; absence of a mapped facility does not mean
        none exists.
      </p>
    </div>
  );
}
