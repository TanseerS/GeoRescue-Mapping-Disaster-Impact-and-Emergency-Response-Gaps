import { SEVERITY_BY_ID } from "../../config/constants";
import type { SeverityLevel } from "../../types/earthquake";

export function SeverityBadge({ level, size = "sm" }: { level: SeverityLevel; size?: "sm" | "md" }) {
  const s = SEVERITY_BY_ID[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${
        size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]"
      }`}
      style={{ color: s.color, borderColor: `${s.color}55`, backgroundColor: `${s.color}14` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
      {s.label}
    </span>
  );
}

/** Square magnitude chip used in lists. */
export function MagnitudeChip({ magnitude, level }: { magnitude: number; level: SeverityLevel }) {
  const s = SEVERITY_BY_ID[level];
  return (
    <span
      className="num flex h-9 w-11 shrink-0 items-center justify-center rounded-lg border text-[13px] font-semibold"
      style={{ color: s.color, borderColor: `${s.color}40`, backgroundColor: `${s.color}12` }}
      aria-label={`Magnitude ${magnitude.toFixed(1)}, ${s.label}`}
    >
      {magnitude.toFixed(1)}
    </span>
  );
}
