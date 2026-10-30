import { List, Radar } from "lucide-react";
import type { ReactNode } from "react";
import { PanelHeader } from "../components/ui/PanelHeader";
import { NAV_ITEMS } from "../components/Sidebar";
import { GapAnalysisPanel } from "../features/analysis/GapAnalysisPanel";
import { EarthquakeDetails } from "../features/earthquakes/EarthquakeDetails";
import { EarthquakeList } from "../features/earthquakes/EarthquakeList";
import { OverviewInsights } from "../features/earthquakes/OverviewInsights";
import { FacilitiesPanel } from "../features/facilities/FacilitiesPanel";
import { MapPanel } from "../features/map/MapPanel";
import type { FocusRequest, MapViewport } from "../features/map/MapView";
import type { FeedStatus } from "../hooks/useEarthquakes";
import type { ResolvedMapStyle } from "../services/mapStyle";
import type { GapAnalysis } from "../types/analysis";
import type { Earthquake, EarthquakeFeed, EarthquakeFilters } from "../types/earthquake";
import type { Facility, FacilityResult, FacilityWithDistance } from "../types/facility";
import type { LayerVisibility, ViewId } from "../types/ui";
import type { EarthquakeStats } from "../utils/stats";
import { AboutPage } from "./AboutPage";

interface DashboardPageProps {
  view: ViewId;
  onViewChange: (view: ViewId) => void;
  now: number;
  statsBar: ReactNode;
  feed: EarthquakeFeed | null;
  filtered: Earthquake[];
  stats: EarthquakeStats;
  dataStatus: FeedStatus;
  dataError: string | null;
  onRetry: () => void;
  filters: EarthquakeFilters;
  onResetFilters: () => void;
  layers: LayerVisibility;
  selected: Earthquake | null;
  selectedResult: FacilityResult | undefined;
  analysis: GapAnalysis | null;
  facilities: Facility[];
  facilityLoading: boolean;
  focus: FocusRequest | null;
  viewport: MapViewport | null;
  mapStyle: ResolvedMapStyle | null;
  areaResult: FacilityResult | undefined;
  areaCenter: { latitude: number; longitude: number } | null;
  onSelect: (id: string) => void;
  onClearSelection: () => void;
  onZoomToSelected: () => void;
  onRetrySelected: () => void;
  onFocusFacility: (facility: FacilityWithDistance) => void;
  onScanArea: () => void;
  onRetryArea: () => void;
  onViewportChange: (viewport: MapViewport) => void;
  onStyleChange: (style: ResolvedMapStyle) => void;
}

export function DashboardPage(props: DashboardPageProps) {
  const { view, selected, now } = props;

  const details = selected ? (
    <EarthquakeDetails
      quake={selected}
      result={props.selectedResult}
      analysis={props.analysis}
      now={now}
      onClose={props.onClearSelection}
      onZoom={props.onZoomToSelected}
      onRetryFacilities={props.onRetrySelected}
      onOpenAnalysis={() => props.onViewChange("analysis")}
      onFocusFacility={props.onFocusFacility}
    />
  ) : null;

  let panel: ReactNode;
  switch (view) {
    case "facilities":
      panel = (
        <FacilitiesPanel
          selected={selected}
          selectedResult={props.selectedResult}
          viewport={props.viewport}
          areaResult={props.areaResult}
          areaCenter={props.areaCenter}
          onScanArea={props.onScanArea}
          onRetryArea={props.onRetryArea}
          onRetrySelected={props.onRetrySelected}
          onFocus={props.onFocusFacility}
        />
      );
      break;
    case "analysis":
      panel = (
        <GapAnalysisPanel
          candidates={props.filtered}
          selected={selected}
          result={props.selectedResult}
          analysis={props.analysis}
          onSelect={props.onSelect}
          onRetry={props.onRetrySelected}
          onFocusFacility={props.onFocusFacility}
        />
      );
      break;
    case "map":
      panel = details ?? (
        <div className="flex h-full flex-col">
          <PanelHeader kicker="Live USGS feed" title={<span className="inline-flex items-center gap-2"><List className="h-4 w-4 text-sky-300" />Earthquake events</span>} />
          <div className="min-h-0 flex-1">
            <EarthquakeList earthquakes={props.filtered} selectedId={null} now={now} onSelect={props.onSelect} />
          </div>
        </div>
      );
      break;
    default:
      panel = details ?? (
        <div>
          <PanelHeader kicker="Situation overview" title={<span className="inline-flex items-center gap-2"><Radar className="h-4 w-4 text-sky-300" />Global seismic activity</span>} />
          <OverviewInsights
            earthquakes={props.filtered}
            stats={props.stats}
            feed={props.feed}
            timeRange={props.filters.timeRange}
            now={now}
            onSelect={props.onSelect}
          />
        </div>
      );
  }

  const panelScrolls = view === "overview" || (view === "map" && Boolean(selected));
  const viewLabel = NAV_ITEMS.find((n) => n.id === view)?.label;

  return (
    <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden" aria-label={viewLabel}>
      <section className="flex min-w-0 flex-col gap-3 p-3 lg:min-h-0 lg:flex-1">
        {props.statsBar}
        <div className="h-[62vh] min-h-[360px] lg:h-auto lg:min-h-0 lg:flex-1">
          <MapPanel
            earthquakes={props.filtered}
            totalLoaded={props.feed?.earthquakes.length ?? 0}
            selected={selected}
            facilities={props.facilities}
            analysis={props.analysis}
            layers={props.layers}
            focus={props.focus}
            dataStatus={props.dataStatus}
            dataError={props.dataError}
            facilityLoading={props.facilityLoading}
            onRetry={props.onRetry}
            onResetFilters={props.onResetFilters}
            onSelect={props.onSelect}
            onZoomToSelected={props.onZoomToSelected}
            onViewportChange={props.onViewportChange}
            onStyleChange={props.onStyleChange}
          />
        </div>
      </section>

      <aside
        aria-label="Information panel"
        className="mx-3 mb-3 min-w-0 shrink-0 lg:mx-0 lg:my-3 lg:mr-3 lg:w-[340px] xl:w-[372px]"
      >
        <div
          className={`panel scrollbar-thin h-full max-h-[80vh] overflow-y-auto lg:max-h-none ${
            panelScrolls ? "" : "flex flex-col lg:overflow-hidden"
          }`}
        >
          {panel}
        </div>
      </aside>

      {view === "about" && (
        <AboutPage
          mapStyle={props.mapStyle}
          source={props.feed?.source ?? null}
          fallbackReason={props.feed?.fallbackReason ?? null}
          onClose={() => props.onViewChange("overview")}
        />
      )}
    </main>
  );
}
