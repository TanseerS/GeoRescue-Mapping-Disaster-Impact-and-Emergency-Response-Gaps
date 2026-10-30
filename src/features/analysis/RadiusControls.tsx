import { RotateCcw } from "lucide-react";
import { ANALYSIS_RADII_KM, FACILITY_SEARCH_RADIUS_KM, RADIUS_PRESETS, type AnalysisRadii } from "../../config/constants";

interface RadiusControlsProps {
  radii: AnalysisRadii;
  onChange: (radii: AnalysisRadii) => void;
}

const LABELS = ["Inner", "Middle", "Outer"];

/** Keeps radii strictly increasing and within the Overpass search radius. */
export function normalizeRadii(radii: number[]): AnalysisRadii {
  const r1 = Math.min(Math.max(1, Math.round(radii[0])), FACILITY_SEARCH_RADIUS_KM - 2);
  const r2 = Math.min(Math.max(r1 + 1, Math.round(radii[1])), FACILITY_SEARCH_RADIUS_KM - 1);
  const r3 = Math.min(Math.max(r2 + 1, Math.round(radii[2])), FACILITY_SEARCH_RADIUS_KM);
  return [r1, r2, r3];
}

export function RadiusControls({ radii, onChange }: RadiusControlsProps) {
  const activePreset = RADIUS_PRESETS.find((p) => p.radii.every((r, i) => r === radii[i]))?.id;
  const isDefault = ANALYSIS_RADII_KM.every((r, i) => r === radii[i]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <div className="grid flex-1 grid-cols-3 gap-1 rounded-lg bg-white/[0.03] p-1" role="radiogroup" aria-label="Radius preset">
          {RADIUS_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={activePreset === preset.id}
              title={`${preset.radii.join(" / ")} km — ${preset.description}`}
              onClick={() => onChange(preset.radii)}
              className={`rounded-md py-1.5 text-[11px] font-medium transition-colors ${
                activePreset === preset.id ? "bg-ink-700 text-white shadow" : "text-ink-400 hover:text-ink-100"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onChange([...ANALYSIS_RADII_KM] as AnalysisRadii)}
          disabled={isDefault}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:bg-white/[0.05] hover:text-white disabled:opacity-30"
          aria-label="Reset radii to 10, 25 and 50 km"
          title="Reset to 10 / 25 / 50 km"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
      {radii.map((value, i) => (
        <label key={LABELS[i]} className="flex items-center gap-3 text-xs">
          <span className="w-12 shrink-0 text-ink-400">{LABELS[i]}</span>
          <input
            type="range"
            min={1}
            max={FACILITY_SEARCH_RADIUS_KM}
            value={value}
            onChange={(e) => {
              const next = [...radii];
              next[i] = Number(e.target.value);
              onChange(normalizeRadii(next));
            }}
            className="h-1 flex-1 cursor-pointer accent-sky-400"
            aria-label={`${LABELS[i]} radius in kilometres`}
          />
          <span className="num w-12 shrink-0 text-right text-ink-100">{value} km</span>
        </label>
      ))}
    </div>
  );
}
