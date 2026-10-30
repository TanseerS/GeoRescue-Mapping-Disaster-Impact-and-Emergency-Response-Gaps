import { ArrowDownWideNarrow, Clock, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { MagnitudeChip } from "../../components/ui/SeverityBadge";
import type { Earthquake } from "../../types/earthquake";
import { formatNumber, formatRelative } from "../../utils/format";

const MAX_ROWS = 150;

interface EarthquakeListProps {
  earthquakes: Earthquake[];
  selectedId: string | null;
  now: number;
  onSelect: (id: string) => void;
}

export function EarthquakeList({ earthquakes, selectedId, now, onSelect }: EarthquakeListProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"time" | "magnitude">("time");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q ? earthquakes.filter((e) => e.place.toLowerCase().includes(q)) : earthquakes;
    const sorted = [...matched].sort((a, b) => (sort === "time" ? b.time - a.time : b.magnitude - a.magnitude));
    return { total: matched.length, items: sorted.slice(0, MAX_ROWS) };
  }, [earthquakes, query, sort]);

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-white/[0.06] px-4 py-3">
        <label className="relative block">
          <span className="sr-only">Search earthquakes by location</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search location, e.g. Alaska"
            className="h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] pl-8 pr-3 text-sm text-ink-100 placeholder:text-ink-500 focus:border-sky-400/50 focus:outline-none"
          />
        </label>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-ink-400">
            <span className="num text-ink-200">{formatNumber(rows.total)}</span> events
            {rows.total > MAX_ROWS && ` · top ${MAX_ROWS} shown`}
          </span>
          <div className="flex rounded-lg bg-white/[0.03] p-0.5" role="radiogroup" aria-label="Sort earthquakes">
            {(
              [
                { id: "time", label: "Latest", icon: <Clock className="h-3 w-3" /> },
                { id: "magnitude", label: "Strongest", icon: <ArrowDownWideNarrow className="h-3 w-3" /> },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={sort === opt.id}
                onClick={() => setSort(opt.id)}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${
                  sort === opt.id ? "bg-ink-700 text-white" : "text-ink-400 hover:text-ink-100"
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <ul className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto p-2">
        {rows.items.length === 0 && <li className="px-3 py-8 text-center text-xs text-ink-400">No events match your search.</li>}
        {rows.items.map((q) => (
          <li key={q.id}>
            <button
              type="button"
              onClick={() => onSelect(q.id)}
              aria-pressed={q.id === selectedId}
              className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors ${
                q.id === selectedId ? "bg-sky-400/10 ring-1 ring-sky-400/30" : "hover:bg-white/[0.04]"
              }`}
            >
              <MagnitudeChip magnitude={q.magnitude} level={q.severity} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-ink-100">{q.place}</span>
                <span className="block text-[11px] text-ink-400">
                  {formatRelative(q.time, now)} · {q.depthKm.toFixed(0)} km deep
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
