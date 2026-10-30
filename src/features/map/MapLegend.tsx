import { ChevronDown, Layers } from "lucide-react";
import { useState } from "react";
import { FACILITY_COLORS, SEVERITIES } from "../../config/constants";

export function MapLegend({ showRings }: { showRings: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="pointer-events-auto w-[210px] rounded-xl border border-white/[0.08] bg-ink-950/90 text-xs shadow-panel backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <Layers className="h-3.5 w-3.5 text-ink-400" />
        <span className="label-xs flex-1 !text-ink-300">Legend</span>
        <ChevronDown className={`h-3.5 w-3.5 text-ink-400 transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-white/[0.06] px-3 pb-3 pt-2.5 animate-fade-in">
          <div>
            <p className="mb-1.5 text-[10.5px] text-ink-400">Earthquake severity</p>
            <ul className="space-y-1">
              {SEVERITIES.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full ring-1 ring-black/40" style={{ backgroundColor: s.color }} />
                  <span className="flex-1 text-ink-200">{s.label}</span>
                  <span className="num text-[10.5px] text-ink-400">M {s.range}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-center gap-2 text-ink-300">
            <span className="flex items-end gap-0.5" aria-hidden="true">
              <span className="h-1.5 w-1.5 rounded-full bg-ink-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-ink-300" />
              <span className="h-3.5 w-3.5 rounded-full bg-ink-300" />
            </span>
            <span className="text-[11px]">Size scales with magnitude</span>
          </div>
          <div className="flex items-center gap-2 text-ink-300">
            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-orange-400 bg-orange-400/25 text-[8px] font-semibold text-white">
              9
            </span>
            <span className="text-[11px]">Cluster · color = strongest</span>
          </div>
          <div className="space-y-1 border-t border-white/[0.06] pt-2.5">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
                <rect x="1" y="1" width="14" height="14" rx="4" fill={FACILITY_COLORS.hospital} />
                <path d="M7 4h2v3h3v2H9v3H7V9H4V7h3z" fill="#fff" />
              </svg>
              <span className="text-ink-200">Hospital</span>
            </div>
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
                <circle cx="8" cy="8" r="7" fill={FACILITY_COLORS.emergency} />
                <path d="M8 4l4 7H4z" fill="#fff" />
              </svg>
              <span className="text-ink-200">Fire / police / ambulance</span>
            </div>
          </div>
          {showRings && (
            <div className="space-y-1 border-t border-white/[0.06] pt-2.5">
              <p className="text-[10.5px] text-ink-400">Analysis radii from epicenter</p>
              <div className="flex items-center gap-3 text-[11px] text-ink-300">
                {[10, 25, 50].map((r, i) => (
                  <span key={r} className="flex items-center gap-1">
                    <span
                      className="h-0 w-3 border-t-2 border-dashed"
                      style={{ borderColor: FACILITY_COLORS.hospital, opacity: 1 - i * 0.25 }}
                    />
                    {r} km
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-ink-300">
                <span className="w-3 border-t-2 border-dotted border-slate-100" /> Nearest hospital
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
