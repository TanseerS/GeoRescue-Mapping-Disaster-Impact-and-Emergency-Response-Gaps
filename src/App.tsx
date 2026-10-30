import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { StatsBar } from "./components/StatsBar";
import { DEFAULT_FILTERS, FACILITY_SEARCH_RADIUS_KM } from "./config/constants";
import type { FocusRequest, MapViewport } from "./features/map/MapView";
import { useEarthquakes } from "./hooks/useEarthquakes";
import { useFacilities } from "./hooks/useFacilities";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { useNow } from "./hooks/useNow";
import { DashboardPage } from "./pages/DashboardPage";
import type { ResolvedMapStyle } from "./services/mapStyle";
import { facilityQueryKey } from "./services/overpass";
import type { Earthquake, EarthquakeFilters } from "./types/earthquake";
import type { FacilityQuery, FacilityWithDistance } from "./types/facility";
import type { LayerVisibility, ViewId } from "./types/ui";
import { analyzeGap } from "./utils/geo";
import { computeStats, filterEarthquakes } from "./utils/stats";

function radiusQuery(quake: Earthquake): FacilityQuery {
  return { type: "radius", latitude: quake.latitude, longitude: quake.longitude, radiusKm: FACILITY_SEARCH_RADIUS_KM };
}

export default function App() {
  const now = useNow();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const [view, setView] = useState<ViewId>("overview");
  const [filters, setFilters] = useState<EarthquakeFilters>(DEFAULT_FILTERS);
  const [layers, setLayers] = useState<LayerVisibility>({ earthquakes: true, hospitals: true, emergency: true });
  const [selected, setSelected] = useState<Earthquake | null>(null);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [mapStyle, setMapStyle] = useState<ResolvedMapStyle | null>(null);
  const [areaKey, setAreaKey] = useState<string | null>(null);
  const [lastAreaQuery, setLastAreaQuery] = useState<FacilityQuery | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { feed, status, error, refresh } = useEarthquakes(filters.timeRange);
  const facilityStore = useFacilities();
  const { request } = facilityStore;

  const filtered = useMemo(() => (feed ? filterEarthquakes(feed.earthquakes, filters) : []), [feed, filters]);
  const stats = useMemo(() => computeStats(filtered), [filtered]);

  // Keep the selected record in sync with refreshed feed data.
  useEffect(() => {
    if (!feed || !selected) return;
    const fresh = feed.earthquakes.find((q) => q.id === selected.id);
    if (fresh && fresh.updated !== selected.updated) setSelected(fresh);
  }, [feed, selected]);

  // Load facilities around every newly selected epicenter.
  useEffect(() => {
    if (selected) request(radiusQuery(selected), "selection");
    // Re-run only when the epicenter changes, not on metadata updates of the same event.
  }, [selected?.id, selected?.latitude, selected?.longitude, request]);

  const selectedKey = selected ? facilityQueryKey(radiusQuery(selected)) : null;
  const selectedResult = selectedKey ? facilityStore.results[selectedKey] : undefined;
  const analysis = useMemo(
    () => (selected && selectedResult?.status === "success" ? analyzeGap(selected, selectedResult.facilities) : null),
    [selected, selectedResult],
  );

  const successfulAreas = Object.values(facilityStore.results).filter((r) => r.status === "success").length;
  const hospitalCount = facilityStore.allFacilities.filter((f) => f.category === "hospital").length;
  const facilityLoading = selectedResult?.status === "loading" || (areaKey ? facilityStore.results[areaKey]?.status === "loading" : false);

  const selectById = useCallback(
    (id: string) => {
      const quake = feed?.earthquakes.find((q) => q.id === id);
      if (quake) setSelected(quake);
    },
    [feed],
  );

  const clearSelection = useCallback(() => setSelected(null), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (drawerOpen) setDrawerOpen(false);
      else if (view === "about") setView("overview");
      else setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, view]);

  const focusOn = useCallback((target: { longitude: number; latitude: number }, zoom?: number) => {
    setFocus({ id: Date.now(), longitude: target.longitude, latitude: target.latitude, zoom });
  }, []);

  const focusFacility = useCallback((f: FacilityWithDistance) => focusOn(f, 14), [focusOn]);

  const scanArea = useCallback(() => {
    if (!viewport) return;
    const query: FacilityQuery = { type: "bbox", bbox: viewport.bbox };
    setLastAreaQuery(query);
    setAreaKey(request(query, "area", true));
  }, [viewport, request]);

  const retryArea = useCallback(() => {
    if (lastAreaQuery) setAreaKey(request(lastAreaQuery, "area", true));
  }, [lastAreaQuery, request]);

  const areaCenter = lastAreaQuery?.type === "bbox"
    ? {
        latitude: (lastAreaQuery.bbox.north + lastAreaQuery.bbox.south) / 2,
        longitude: (lastAreaQuery.bbox.east + lastAreaQuery.bbox.west) / 2,
      }
    : null;

  const filtersDirty =
    filters.timeRange !== DEFAULT_FILTERS.timeRange ||
    filters.minMagnitude !== DEFAULT_FILTERS.minMagnitude ||
    filters.severities.length !== DEFAULT_FILTERS.severities.length;

  const changeView = (next: ViewId) => {
    setView(next);
    setDrawerOpen(false);
  };

  const sidebarProps = {
    view,
    onViewChange: changeView,
    layers,
    onLayersChange: setLayers,
    filters,
    onFiltersChange: setFilters,
    onResetFilters: () => setFilters(DEFAULT_FILTERS),
    filtersDirty,
    collapsed,
    onToggleCollapsed: () => setCollapsed((c) => !c),
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-ink-950">
      <Header
        status={status}
        lastUpdated={feed?.fetchedAt ?? null}
        timeRange={filters.timeRange}
        mapStyle={mapStyle}
        now={now}
        onRefresh={refresh}
        onOpenMenu={() => setDrawerOpen(true)}
      />

      <div className="flex min-h-0 flex-1">
        {isDesktop ? (
          <Sidebar {...sidebarProps} />
        ) : (
          drawerOpen && (
            <div className="fixed inset-0 z-40 flex" role="dialog" aria-modal="true" aria-label="Navigation">
              <div className="h-full animate-fade-in shadow-2xl">
                <Sidebar {...sidebarProps} mobile onClose={() => setDrawerOpen(false)} />
              </div>
              <button
                type="button"
                className="flex-1 bg-black/60 backdrop-blur-[1px]"
                aria-label="Close navigation"
                onClick={() => setDrawerOpen(false)}
              />
            </div>
          )
        )}

        <DashboardPage
          view={view}
          onViewChange={changeView}
          now={now}
          statsBar={
            <StatsBar
              stats={stats}
              loading={status === "loading"}
              facilityCount={facilityStore.allFacilities.length}
              hospitalCount={hospitalCount}
              analyzedAreas={successfulAreas}
              onSelectStrongest={(q) => setSelected(q)}
            />
          }
          feed={feed}
          filtered={filtered}
          stats={stats}
          dataStatus={status}
          dataError={error}
          onRetry={refresh}
          filters={filters}
          onResetFilters={() => setFilters(DEFAULT_FILTERS)}
          layers={layers}
          selected={selected}
          selectedResult={selectedResult}
          analysis={analysis}
          facilities={facilityStore.allFacilities}
          facilityLoading={facilityLoading}
          focus={focus}
          viewport={viewport}
          mapStyle={mapStyle}
          areaResult={areaKey ? facilityStore.results[areaKey] : undefined}
          areaCenter={areaCenter}
          onSelect={selectById}
          onClearSelection={clearSelection}
          onZoomToSelected={() => selected && focusOn(selected, 9)}
          onRetrySelected={() => selected && request(radiusQuery(selected), "selection", true)}
          onFocusFacility={focusFacility}
          onScanArea={scanArea}
          onRetryArea={retryArea}
          onViewportChange={setViewport}
          onStyleChange={setMapStyle}
        />
      </div>
    </div>
  );
}
