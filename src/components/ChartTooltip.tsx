import type { TooltipProps } from "recharts";

interface ChartTooltipProps extends TooltipProps<number, string> {
  formatLabel?: (label: string) => string;
  unit?: string;
}

/** Dark tooltip shared by every Recharts chart. */
export function ChartTooltip({ active, payload, label, formatLabel, unit = "events" }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/[0.1] bg-ink-950/95 px-2.5 py-1.5 text-xs shadow-panel">
      <p className="text-ink-400">{formatLabel ? formatLabel(String(label)) : label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="num font-medium text-white">
          {p.value} <span className="font-sans font-normal text-ink-400">{p.name && p.name !== "count" ? p.name : unit}</span>
        </p>
      ))}
    </div>
  );
}
