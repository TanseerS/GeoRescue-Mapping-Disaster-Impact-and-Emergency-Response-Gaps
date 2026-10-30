import { AlertTriangle, Crosshair, Globe2, RefreshCw, SearchX } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Spinner } from "../../components/ui/Spinner";
import type { ResolvedMapStyle } from "../../services/mapStyle";
import type { GapAnalysis } from "../../types/analysis";
import type { Earthquake } from "../../types/earthquake";
import type { Facility } from "../../types/facility";
import type { LayerVisibility } from "../../types/ui";
import { formatNumber } from "../../utils/format";
import { MapLegend } from "./MapLegend";
import { MapView, type FocusRequest, type MapViewport } from "./MapView";

interface MapPanelProps {
  earthquakes: Earthquake[];
  totalLoaded: number;
  selected: Earthquake | null;
  facilities: Facility[];
  analysis: GapAnalysis | null;
  layers: LayerVisibility;
  focus: FocusRequest | null;
  dataStatus: "loading" | "refreshing" | "ready" | "error";
  dataError: string | null;
  facilityLoading: boolean;
  onRetry: () => void;
  onResetFilters: () => void;
  onSelect: (id: string) => void;
  onZoomToSelected: () => void;
  onViewportChange: (viewport: MapViewport) => void;
  onStyleChange: (style: ResolvedMapStyle) => void;
}

export function MapPanel(props: MapPanelProps) {
  const { earthquakes, totalLoaded, selected, dataStatus, dataError } = props;
  const [resetSignal, setResetSignal] = useState(0);
  const [mapState, setMapState] = useState<"loading" | "ready" | "error">("loading");
  const [mapKey, setMapKey] = useState(0);

  const noData = dataStatus === "loading";
  const hasError = dataStatus === "error" && totalLoaded === 0;
  const filteredOut = dataStatus !== "loading" && totalLoaded > 0 && earthquakes.length === 0;

  return (
    <div className="panel relative h-full min-h-[360px] overflow-hidden !rounded-2xl bg-ink-900">
      <MapView
        key={mapKey}
        earthquakes={earthquakes}
        selected={selected}
        facilities={props.facilities}
        analysis={props.analysis}
        layers={props.layers}
        focus={props.focus}
        resetSignal={resetSignal}
        onSelect={props.onSelect}
        onViewportChange={props.onViewportChange}
        onStyleChange={props.onStyleChange}
        onReadyChange={setMapState}
      />

      {/* Top-left status chips */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2">
        <span className="pointer-events-auto inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-ink-950/85 px-2.5 py-1.5 text-xs text-ink-200 shadow-panel backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
          <span className="num font-medium text-white">{formatNumber(earthquakes.length)}</span>
          <span className="text-ink-400">of {formatNumber(totalLoaded)} events shown</span>
        </span>
        {(dataStatus === "refreshing" || props.facilityLoading) && (
          <span className="inline-flex items-center gap-2 rounded-lg border border-sky-400/20 bg-ink-950/85 px-2.5 py-1.5 text-xs text-sky-200 backdrop-blur">
            <Spinner className="h-3.5 w-3.5" />
            {props.facilityLoading ? "Mapping nearby facilities…" : "Syncing feed…"}
          </span>
        )}
        {dataStatus === "error" && totalLoaded > 0 && (
          <button
            type="button"
            onClick={props.onRetry}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-lg border border-rose-500/30 bg-ink-950/85 px-2.5 py-1.5 text-xs text-rose-200 backdrop-blur hover:bg-rose-500/10"
          >
            <AlertTriangle className="h-3.5 w-3.5" /> Refresh failed · showing cached data · Retry
          </button>
        )}
      </div>

      {/* Map action buttons (beneath zoom controls) */}
      <div className="absolute right-[10px] top-[86px] z-10 flex flex-col overflow-hidden rounded-[10px] border border-white/[0.08] bg-ink-850/95 shadow-panel">
        <button
          type="button"
          onClick={() => setResetSignal((n) => n + 1)}
          className="flex h-8 w-8 items-center justify-center text-ink-200 hover:bg-sky-400/10"
          aria-label="Reset to global view"
          title="Reset to global view"
        >
          <Globe2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={props.onZoomToSelected}
          disabled={!selected}
          className="flex h-8 w-8 items-center justify-center border-t border-white/[0.08] text-ink-200 hover:bg-sky-400/10 disabled:opacity-35 disabled:hover:bg-transparent"
          aria-label="Zoom to selected earthquake"
          title="Zoom to selected earthquake"
        >
          <Crosshair className="h-4 w-4" />
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 z-10 hidden sm:block">
        <MapLegend showRings={Boolean(selected)} />
      </div>

      {(noData || mapState === "loading") && !hasError && mapState !== "error" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink-950/50 backdrop-blur-[2px] animate-fade-in">
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-ink-900/95 px-4 py-3 shadow-panel">
            <Spinner className="h-5 w-5 text-sky-400" />
            <div>
              <p className="text-sm font-medium text-white">{noData ? "Fetching live USGS earthquake feed" : "Loading basemap"}</p>
              <p className="text-xs text-ink-400">Real-time seismic events from earthquake.usgs.gov</p>
            </div>
          </div>
        </div>
      )}

      {hasError && (
        <OverlayCard
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="error"
          title="Earthquake feed unavailable"
          description={dataError ?? "The USGS feed could not be loaded."}
          action={
            <Button variant="primary" icon={<RefreshCw className="h-4 w-4" />} onClick={props.onRetry}>
              Retry
            </Button>
          }
        />
      )}

      {mapState === "error" && (
        <OverlayCard
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="error"
          title="Basemap failed to load"
          description="The map style could not be reached. Check your network connection or map configuration."
          action={
            <Button variant="primary" icon={<RefreshCw className="h-4 w-4" />} onClick={() => setMapKey((k) => k + 1)}>
              Reload map
            </Button>
          }
        />
      )}

      {filteredOut && (
        <div className="absolute inset-x-0 top-16 z-10 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-ink-950/90 px-4 py-2.5 text-sm shadow-panel backdrop-blur animate-fade-in">
            <SearchX className="h-4 w-4 text-ink-400" />
            <span className="text-ink-200">No earthquakes match the current filters.</span>
            <Button size="sm" variant="secondary" onClick={props.onResetFilters}>
              Reset filters
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function OverlayCard(props: { icon: React.ReactNode; title: string; description: string; action: React.ReactNode; tone: "error" }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink-950/60 p-4 backdrop-blur-sm">
      <div className="max-w-sm rounded-2xl border border-rose-500/20 bg-ink-900/95 p-5 text-center shadow-panel animate-fade-in" role="alert">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">{props.icon}</div>
        <p className="font-display text-base font-semibold text-white">{props.title}</p>
        <p className="mt-1 text-sm text-ink-300">{props.description}</p>
        <div className="mt-4 flex justify-center">{props.action}</div>
      </div>
    </div>
  );
}
