import { Building2, Crosshair, Info, ScanSearch } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { PanelHeader } from "../../components/ui/PanelHeader";
import { FACILITY_COLORS, FACILITY_SEARCH_RADIUS_KM } from "../../config/constants";
import type { Earthquake } from "../../types/earthquake";
import type { BoundingBox, FacilityCategory, FacilityKind, FacilityResult, FacilityWithDistance } from "../../types/facility";
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
}

type Source = "event" | "area";
type CategoryFilter = "all" | FacilityCategory;

export function FacilitiesPanel(props: FacilitiesPanelProps) {
  const { selected, selectedResult, viewport, areaResult, areaCenter } = props;
  const [source, setSource] = useState<Source>(selected ? "event" : "area");
  const [category, setCategory] = useState<CategoryFilter>("all");

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
    const counts: Record<FacilityKind, number> = { hospital: 0, fire_station: 0, police: 0, ambulance_station: 0 };
    facilities.forEach((f) => (counts[f.kind] += 1));
    return counts;
  }, [facilities]);

  const visible = category === "all" ? facilities : facilities.filter((f) => f.category === category);
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
            description={`Select an earthquake on the map to load hospitals and emergency facilities within ${FACILITY_SEARCH_RADIUS_KM} km.`}
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
            <div className="grid grid-cols-2 gap-2 px-4 pt-3">
              {(Object.keys(byKind) as FacilityKind[]).map((kind) => (
                <div key={kind} className="panel-muted flex items-center gap-2 px-2.5 py-2">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-md"
                    style={{
                      color: kind === "hospital" ? FACILITY_COLORS.hospital : FACILITY_COLORS.emergency,
                      backgroundColor: kind === "hospital" ? `${FACILITY_COLORS.hospital}1a` : `${FACILITY_COLORS.emergency}1a`,
                    }}
                  >
                    {FACILITY_KIND_META[kind].icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-ink-300">{FACILITY_KIND_META[kind].label}</span>
                  <span className="num text-sm font-semibold text-white">{byKind[kind]}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-3">
              <p className="text-[11px] text-ink-400">
                <span className="num text-ink-200">{formatNumber(visible.length)}</span>{" "}
                {visible.length === 1 ? "facility" : "facilities"} ·{" "}
                {source === "event" ? `within ${FACILITY_SEARCH_RADIUS_KM} km of epicenter` : selected ? "distance from epicenter" : "distance from area center"}
              </p>
              <div className="flex rounded-lg bg-white/[0.03] p-0.5" role="radiogroup" aria-label="Facility type">
                {(["all", "hospital", "emergency"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={category === c}
                    onClick={() => setCategory(c)}
                    className={`rounded-md px-2 py-1 text-[11px] font-medium capitalize ${
                      category === c ? "bg-ink-700 text-white" : "text-ink-400 hover:text-ink-100"
                    }`}
                  >
                    {c === "hospital" ? "Hospitals" : c}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-2 pb-4">
              {visible.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-ink-400">
                  No {category === "all" ? "facilities" : category === "hospital" ? "hospitals" : "emergency facilities"} are
                  mapped in this area.
                </p>
              ) : (
                <FacilityList facilities={visible} limit={200} onFocus={props.onFocus} />
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
