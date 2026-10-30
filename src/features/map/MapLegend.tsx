import { ChevronDown, Layers } from "lucide-react";
import { useState } from "react";
import { DEPTH_CLASSES, FACILITY_COLORS, FACILITY_KINDS, SEVERITIES } from "../../config/constants";
import type { FacilityKind } from "../../types/facility";
import type { LayerVisibility, MapSettings } from "../../types/ui";

const HEAT_GRADIENT = "linear-gradient(90deg, rgba(76,29,149,0.55), #7c3aed, #db2777, #f97316, #fde047)";

/** Small SVG versions of the map's facility icons. */
function FacilityGlyph({ kind }: { kind: FacilityKind }) {
  const health = kind === "hospital" || kind === "clinic";
  const fill = health ? FACILITY_COLORS.hospital : FACILITY_COLORS.emergency;
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
      {kind === "hospital" ? <rect x="1" y="1" width="14" height="14" rx="4" fill={fill} /> : <circle cx="8" cy="8" r="7" fill={fill} />}
      {kind === "hospital" && <path d="M7 4h2v3h3v2H9v3H7V9H4V7h3z" fill="#fff" />}
      {kind === "clinic" && <path d="M7.3 5h1.4v2.3H11v1.4H8.7V11H7.3V8.7H5V7.3h2.3z" fill="#fff" />}
      {kind === "fire_station" && <path d="M8 4l4 7H4z" fill="#fff" />}
      {kind === "ambulance_station" && <circle cx="8" cy="8" r="3.3" fill="none" stroke="#fff" strokeWidth="1.4" />}
      {kind === "police" && <path d="M8 3.8l3.4 1.8-.7 4.2L8 12.2 5.3 9.8l-.7-4.2z" fill="#fff" />}
    </svg>
  );
}

interface MapLegendProps {
  settings: MapSettings;
  radii: readonly number[];
  showRings: boolean;
  layers: LayerVisibility;
}

export function MapLegend({ settings, radii, showRings, layers }: MapLegendProps) {
  // Start collapsed on shorter screens so the legend does not cover the map.
  const [open, setOpen] = useState(() => window.innerHeight >= 860);
  const visibleKinds = FACILITY_KINDS.filter((k) => layers.facilities[k.id]);
  const heatmap = settings.displayMode === "heatmap";

  return (
    <div className="pointer-events-auto w-[214px] rounded-xl border border-white/[0.08] bg-ink-950/90 text-xs shadow-panel backdrop-blur">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2 text-left">
        <Layers className="h-3.5 w-3.5 text-ink-400" />
        <span className="label-xs flex-1 !text-ink-300">Legend</span>
        <ChevronDown className={`h-3.5 w-3.5 text-ink-400 transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-white/[0.06] px-3 pb-3 pt-2.5 animate-fade-in">
          {layers.earthquakes && heatmap && (
            <div>
              <p className="mb-1.5 text-[10.5px] text-ink-400">Magnitude-weighted event density</p>
              <div className="h-2 rounded-full" style={{ background: HEAT_GRADIENT }} />
              <div className="mt-1 flex justify-between text-[10px] text-ink-500">
                <span>Lower</span>
                <span>Higher</span>
              </div>
              <p className="mt-1.5 text-[10.5px] text-ink-500">Individual events appear when zoomed in.</p>
            </div>
          )}
          {layers.earthquakes && !heatmap && (
            <div>
              <p className="mb-1.5 text-[10.5px] text-ink-400">{settings.colorBy === "depth" ? "Focal depth" : "Earthquake magnitude"}</p>
              <ul className="space-y-1">
                {settings.colorBy === "depth"
                  ? DEPTH_CLASSES.map((d) => (
                      <li key={d.id} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full ring-1 ring-black/40" style={{ backgroundColor: d.color }} />
                        <span className="flex-1 text-ink-200">{d.label}</span>
                        <span className="num text-[10.5px] text-ink-400">{d.range}</span>
                      </li>
                    ))
                  : SEVERITIES.map((s) => (
                      <li key={s.id} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full ring-1 ring-black/40" style={{ backgroundColor: s.color }} />
                        <span className="flex-1 text-ink-200">{s.label}</span>
                        <span className="num text-[10.5px] text-ink-400">M {s.range}</span>
                      </li>
                    ))}
              </ul>
              <div className="mt-2 flex items-center gap-2 text-ink-300">
                <span className="flex items-end gap-0.5" aria-hidden="true">
                  <span className="h-1.5 w-1.5 rounded-full bg-ink-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-ink-300" />
                  <span className="h-3.5 w-3.5 rounded-full bg-ink-300" />
                </span>
                <span className="text-[11px]">Size scales with magnitude</span>
              </div>
              {settings.displayMode === "clusters" && (
                <p className="mt-1.5 text-[11px] text-ink-300">
                  Clusters: {settings.colorBy === "depth" ? "color = mean depth" : "color = strongest event"}
                </p>
              )}
            </div>
          )}
          {visibleKinds.length > 0 && (
            <div className="space-y-1 border-t border-white/[0.06] pt-2.5">
              {visibleKinds.map((k) => (
                <div key={k.id} className="flex items-center gap-2">
                  <FacilityGlyph kind={k.id} />
                  <span className="text-ink-200">{k.plural}</span>
                </div>
              ))}
            </div>
          )}
          {showRings && (
            <div className="space-y-1 border-t border-white/[0.06] pt-2.5">
              <p className="text-[10.5px] text-ink-400">Analysis radii from epicenter</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-300">
                {radii.map((r, i) => (
                  <span key={r} className="flex items-center gap-1">
                    <span className="h-0 w-3 border-t-2 border-dashed" style={{ borderColor: FACILITY_COLORS.hospital, opacity: 1 - i * 0.25 }} />
                    {r} km
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-ink-300">
                <span className="w-3 border-t-2 border-dotted border-slate-100" /> Nearest hospital (straight line)
              </div>
              <div className="flex items-center gap-2 text-[11px] text-ink-300">
                <span className="w-3 border-t-[3px] border-slate-100" /> Driving route (when calculated)
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
