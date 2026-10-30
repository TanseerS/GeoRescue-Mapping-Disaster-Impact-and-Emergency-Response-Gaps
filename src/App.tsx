import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { StatsBar } from "./components/StatsBar";
import { ANALYSIS_RADII_KM, DEFAULT_FILTERS, FACILITY_KINDS, FACILITY_SEARCH_RADIUS_KM, type AnalysisRadii } from "./config/constants";
import { normalizeRadii } from "./features/analysis/RadiusControls";
import type { FocusRequest, MapViewport } from "./features/map/MapView";
import { useEarthquakes } from "./hooks/useEarthquakes";
import { useFacilities } from "./hooks/useFacilities";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { useNow } from "./hooks/useNow";
import { usePersistentState } from "./hooks/usePersistentState";
import { usePopulation } from "./hooks/usePopulation";
import { useRoute } from "./hooks/useRoute";
import { DashboardPage } from "./pages/DashboardPage";
import type { ResolvedMapStyle } from "./services/mapStyle";
import { facilityQueryKey } from "./services/overpass";
import type { Earthquake, EarthquakeFilters } from "./types/earthquake";
import type { FacilityQuery, FacilityWithDistance } from "./types/facility";
import type { LayerVisibility, MapSettings, ViewId } from "./types/ui";
import { analyzeGap } from "./utils/geo";
import { buildBrief } from "./utils/intelligence";
import { computeStats, filterEarthquakes, regionBounds } from "./utils/stats";

const DEFAULT_LAYERS: LayerVisibility = {
  earthquakes: true,
  facilities: Object.fromEntries(FACILITY_KINDS.map((k) => [k.id, true])) as LayerVisibility["facilities"],
};

const isRadii = (v: unknown): v is AnalysisRadii =>
  Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number") && normalizeRadii(v).every((n, i) => n === v[i]);

const isMapSettings = (v: unknown): v is MapSettings => {
  const m = v as MapSettings | null;
  return !!m && ["markers", "clusters", "heatmap"].includes(m.displayMode) && ["severity", "depth"].includes(m.colorBy);
};

function radiusQuery(quake: Earthquake): FacilityQuery {
  return { type: "radius", latitude: quake.latitude, longitude: quake.longitude, radiusKm: FACILITY_SEARCH_RADIUS_KM };
}

export default function App() {
  const now = useNow();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const [view, setView] = useState<ViewId>("overview");
  const [filters, setFilters] = useState<EarthquakeFilters>(DEFAULT_FILTERS);
  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYERS);
  const [mapSettings, setMapSettings] = usePersistentState<MapSettings>(
    "georescue:map-settings",
    { displayMode: "clusters", colorBy: "severity" },
    isMapSettings,
  );
  const [radii, setRadii] = usePersistentState<AnalysisRadii>("georescue:radii", [...ANALYSIS_RADII_KM] as AnalysisRadii, isRadii);
  const [selected, setSelected] = useState<Earthquake | null>(null);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [populationAttempt, setPopulationAttempt] = useState(0);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [mapStyle, setMapStyle] = useState<ResolvedMapStyle | null>(null);
  const [areaKey, setAreaKey] = useState<string | null>(null);
  const [lastAreaQuery, setLastAreaQuery] = useState<FacilityQuery | null>(null);
  // Below 1280 px the sidebar starts collapsed so the map keeps most of the width.
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1280);
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
    () => (selected && selectedResult?.status === "success" ? analyzeGap(selected, selectedResult.facilities, radii) : null),
    [selected, selectedResult, radii],
  );

  const population = usePopulation(selected, radii, populationAttempt);
  const routing = useRoute(selected);
  const selectedFacility = useMemo(
    () => (selectedFacilityId ? facilityStore.allFacilities.find((f) => f.id === selectedFacilityId) ?? null : null),
    [selectedFacilityId, facilityStore.allFacilities],
  );
  const routeCoordinates = routing.state.status === "success" ? routing.state.result.coordinates : null;

  const brief = useMemo(
    () =>
      selected
        ? buildBrief({
            quake: selected,
            analysis,
            radii,
            population: population.status === "success" ? population.data : null,
            facilitiesUnavailable: selectedResult?.status === "error",
            now,
          })
        : null,
    [selected, analysis, radii, population, selectedResult?.status, now],
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
      else if (selectedFacilityId) setSelectedFacilityId(null);
      else setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, view, selectedFacilityId]);

  const focusOn = useCallback((target: { longitude: number; latitude: number }, zoom?: number) => {
    setFocus({ id: Date.now(), longitude: target.longitude, latitude: target.latitude, zoom });
  }, []);

  const focusFacility = useCallback(
    (f: FacilityWithDistance) => {
      setSelectedFacilityId(f.id);
      focusOn(f, 14);
    },
    [focusOn],
  );

  const focusRegion = useCallback(
    (region: string) => {
      const bounds = regionBounds(filtered, region);
      if (bounds) setFocus({ id: Date.now(), bounds });
    },
    [filtered],
  );

  const retryPopulation = useCallback(() => setPopulationAttempt((n) => n + 1), []);
  const zoomToSelected = useCallback(() => {
    if (selected) focusOn(selected, 9);
  }, [selected, focusOn]);
  const retrySelected = useCallback(() => {
    if (selected) request(radiusQuery(selected), "selection", true);
  }, [selected, request]);

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
        source={feed?.source ?? null}
        fallbackReason={feed?.fallbackReason ?? null}
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
          onZoomToSelected={zoomToSelected}
          onRetrySelected={retrySelected}
          mapSettings={mapSettings}
          onMapSettingsChange={setMapSettings}
          radii={radii}
          onRadiiChange={setRadii}
          population={population}
          onRetryPopulation={retryPopulation}
          routing={routing}
          routeCoordinates={routeCoordinates}
          brief={brief}
          selectedFacility={selectedFacility}
          onSelectFacility={setSelectedFacilityId}
          onFocusRegion={focusRegion}
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
