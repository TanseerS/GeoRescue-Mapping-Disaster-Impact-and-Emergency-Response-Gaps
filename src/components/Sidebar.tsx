import {
  Activity,
  Building2,
  ChevronsLeft,
  ChevronsRight,
  Info,
  LayoutDashboard,
  Map as MapIcon,
  RotateCcw,
  ShieldAlert,
  Users,
  Waves,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { FACILITY_KINDS, FEEDS, MAGNITUDE_OPTIONS, SEVERITIES, TIME_RANGES } from "../config/constants";
import type { EarthquakeFilters, SeverityLevel } from "../types/earthquake";
import type { LayerVisibility, ViewId } from "../types/ui";
import { Toggle } from "./ui/Toggle";

export const NAV_ITEMS: { id: ViewId; label: string; icon: ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard className="h-[18px] w-[18px]" /> },
  { id: "map", label: "Earthquake Map", icon: <MapIcon className="h-[18px] w-[18px]" /> },
  { id: "facilities", label: "Emergency Facilities", icon: <Building2 className="h-[18px] w-[18px]" /> },
  { id: "analysis", label: "Response Gap Analysis", icon: <ShieldAlert className="h-[18px] w-[18px]" /> },
  { id: "about", label: "About", icon: <Info className="h-[18px] w-[18px]" /> },
];

interface SidebarProps {
  view: ViewId;
  onViewChange: (view: ViewId) => void;
  layers: LayerVisibility;
  onLayersChange: (layers: LayerVisibility) => void;
  filters: EarthquakeFilters;
  onFiltersChange: (filters: EarthquakeFilters) => void;
  onResetFilters: () => void;
  filtersDirty: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Drawer mode on small screens. */
  mobile?: boolean;
  onClose?: () => void;
}

export function Sidebar(props: SidebarProps) {
  const { view, onViewChange, layers, onLayersChange, filters, onFiltersChange, collapsed, mobile } = props;
  const compact = collapsed && !mobile;

  const allFacilitiesOn = FACILITY_KINDS.every((k) => layers.facilities[k.id]);
  const setAllFacilities = (on: boolean) =>
    onLayersChange({ ...layers, facilities: Object.fromEntries(FACILITY_KINDS.map((k) => [k.id, on])) as LayerVisibility["facilities"] });

  const toggleSeverity = (id: SeverityLevel) => {
    const next = filters.severities.includes(id)
      ? filters.severities.filter((s) => s !== id)
      : SEVERITIES.map((s) => s.id).filter((s) => s === id || filters.severities.includes(s));
    onFiltersChange({ ...filters, severities: next });
  };

  return (
    <nav
      aria-label="Primary"
      className={`flex h-full flex-col border-r border-white/[0.06] bg-ink-950 transition-[width] duration-200 ${
        mobile ? "w-[288px]" : compact ? "w-[60px]" : "w-[248px]"
      }`}
    >
      {mobile && (
        <div className="flex items-center justify-between px-4 pb-1 pt-3">
          <span className="label-xs">Navigation</span>
          <button
            type="button"
            onClick={props.onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-300 hover:bg-white/[0.06]"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="scrollbar-thin flex-1 overflow-y-auto overflow-x-hidden">
        <ul className={`space-y-0.5 ${compact ? "px-2 pt-3" : "px-3 pt-3"}`}>
          {NAV_ITEMS.map((item) => {
            const active = view === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onViewChange(item.id)}
                  aria-current={active ? "page" : undefined}
                  title={compact ? item.label : undefined}
                  className={`relative flex w-full items-center gap-3 rounded-lg py-2 text-[13.5px] font-medium transition-colors ${
                    compact ? "justify-center px-0" : "px-2.5"
                  } ${active ? "bg-sky-400/10 text-white" : "text-ink-300 hover:bg-white/[0.04] hover:text-ink-100"}`}
                >
                  {active && <span className="absolute left-0 top-1.5 h-[calc(100%-12px)] w-[3px] rounded-r bg-sky-400" />}
                  <span className={active ? "text-sky-300" : ""}>{item.icon}</span>
                  {!compact && <span className="truncate">{item.label}</span>}
                </button>
              </li>
            );
          })}
        </ul>

        {!compact && (
          <>
            <div className="mx-3 my-4 h-px bg-white/[0.06]" />

            <div className="px-3">
              <h2 className="label-xs mb-1.5 px-2">Map layers</h2>
              <Toggle
                label="Earthquakes"
                icon={<Activity className="h-3.5 w-3.5 text-orange-400" />}
                checked={layers.earthquakes}
                onChange={(v) => onLayersChange({ ...layers, earthquakes: v })}
              />
              <div className="mt-2 px-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs text-ink-300">Facilities (OpenStreetMap)</span>
                  <button
                    type="button"
                    onClick={() => setAllFacilities(!allFacilitiesOn)}
                    className="rounded px-1 text-[10.5px] font-medium text-sky-300 hover:bg-sky-400/10"
                  >
                    {allFacilitiesOn ? "Hide all" : "Show all"}
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {FACILITY_KINDS.map((kind) => {
                    const on = layers.facilities[kind.id];
                    return (
                      <label
                        key={kind.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                          on ? "border-white/[0.08] bg-white/[0.03] text-ink-100" : "border-transparent text-ink-500 hover:text-ink-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={on}
                          onChange={() => onLayersChange({ ...layers, facilities: { ...layers.facilities, [kind.id]: !on } })}
                        />
                        <span
                          className="flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border"
                          style={{ borderColor: kind.color, backgroundColor: on ? kind.color : "transparent" }}
                          aria-hidden="true"
                        >
                          {on && <span className="h-1.5 w-1.5 rounded-[1px] bg-ink-950" />}
                        </span>
                        <span className="flex-1 font-medium">{kind.plural}</span>
                        <span className="text-[10px] text-ink-500">{kind.group === "health" ? "Health" : "Emergency"}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <Toggle
                label="Population density layer"
                hint="Not available · see exposure estimate"
                icon={<Users className="h-3.5 w-3.5" />}
                checked={false}
                onChange={() => undefined}
                disabled
              />
            </div>

            <div className="mx-3 my-4 h-px bg-white/[0.06]" />

            <div className="space-y-4 px-5 pb-5">
              <div className="flex items-center justify-between">
                <h2 className="label-xs">Filters</h2>
                <button
                  type="button"
                  onClick={props.onResetFilters}
                  disabled={!props.filtersDirty}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-sky-300 hover:bg-sky-400/10 disabled:text-ink-500 disabled:hover:bg-transparent"
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </button>
              </div>

              <fieldset>
                <legend className="mb-1.5 text-xs text-ink-300">Time range</legend>
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-white/[0.03] p-1" role="radiogroup">
                  {TIME_RANGES.map((range) => (
                    <button
                      key={range}
                      type="button"
                      role="radio"
                      aria-checked={filters.timeRange === range}
                      onClick={() => onFiltersChange({ ...filters, timeRange: range })}
                      title={FEEDS[range].label}
                      className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                        filters.timeRange === range ? "bg-ink-700 text-white shadow" : "text-ink-400 hover:text-ink-100"
                      }`}
                    >
                      {FEEDS[range].short}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-1.5 text-xs text-ink-300">Minimum magnitude</legend>
                <div className="grid grid-cols-5 gap-1 rounded-lg bg-white/[0.03] p-1" role="radiogroup">
                  {MAGNITUDE_OPTIONS.map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      role="radio"
                      aria-checked={filters.minMagnitude === opt.value}
                      aria-label={opt.value === -Infinity ? "All magnitudes" : `Magnitude ${opt.value} and above`}
                      onClick={() => onFiltersChange({ ...filters, minMagnitude: opt.value })}
                      className={`rounded-md py-1.5 text-[11px] font-medium transition-colors ${
                        filters.minMagnitude === opt.value ? "bg-ink-700 text-white shadow" : "text-ink-400 hover:text-ink-100"
                      }`}
                    >
                      {opt.value === -Infinity ? "All" : opt.value.toFixed(1)}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-1.5 text-xs text-ink-300">Severity</legend>
                <div className="space-y-1">
                  {SEVERITIES.map((s) => {
                    const on = filters.severities.includes(s.id);
                    return (
                      <label
                        key={s.id}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                          on ? "border-white/[0.08] bg-white/[0.03] text-ink-100" : "border-transparent text-ink-500 hover:text-ink-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={on}
                          onChange={() => toggleSeverity(s.id)}
                        />
                        <span
                          className="flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border"
                          style={{ borderColor: s.color, backgroundColor: on ? s.color : "transparent" }}
                          aria-hidden="true"
                        >
                          {on && <span className="h-1.5 w-1.5 rounded-[1px] bg-ink-950" />}
                        </span>
                        <span className="flex-1 font-medium">{s.label}</span>
                        <span className="num text-[11px] text-ink-400">M {s.range}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          </>
        )}
      </div>

      {!mobile && (
        <div className={`border-t border-white/[0.06] p-2 ${compact ? "" : "flex items-center justify-between"}`}>
          {!compact && (
            <span className="flex items-center gap-1.5 px-2 text-[11px] text-ink-500">
              <Waves className="h-3.5 w-3.5" /> USGS · OSM
            </span>
          )}
          <button
            type="button"
            onClick={props.onToggleCollapsed}
            className="inline-flex h-8 w-full items-center justify-center rounded-lg text-ink-400 hover:bg-white/[0.05] hover:text-ink-100 lg:w-8"
            aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
            title={compact ? "Expand sidebar" : "Collapse sidebar"}
          >
            {compact ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>
      )}
    </nav>
  );
}
