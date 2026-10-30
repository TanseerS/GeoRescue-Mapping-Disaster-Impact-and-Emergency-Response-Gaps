import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, MapGeoJSONFeature } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { FACILITY_SEARCH_RADIUS_KM, INITIAL_BOUNDS, SEVERITY_BY_ID } from "../../config/constants";
import { fallbackMapStyle, resolveMapStyle, type ResolvedMapStyle } from "../../services/mapStyle";
import type { GapAnalysis } from "../../types/analysis";
import type { Earthquake, SeverityLevel } from "../../types/earthquake";
import type { BoundingBox, Facility } from "../../types/facility";
import type { LayerVisibility, MapSettings } from "../../types/ui";
import { formatMagnitude, formatRelative } from "../../utils/format";
import { depthClass } from "../../utils/stats";
import {
  earthquakesToGeoJSON,
  facilitiesToGeoJSON,
  nearestLineToGeoJSON,
  pointToGeoJSON,
  ringLabelsToGeoJSON,
  ringsToGeoJSON,
  routeToGeoJSON,
  selectedToGeoJSON,
} from "./mapData";
import { applyMapSettings, EARTHQUAKE_POINT_LAYERS, installLayers, LAYERS, SOURCES } from "./mapLayers";

// MapLibre resolves its worker relative to its own module URL, which bundling breaks; point it at the emitted asset.
maplibregl.setWorkerUrl(maplibreWorkerUrl);

export interface FocusRequest {
  id: number;
  longitude?: number;
  latitude?: number;
  zoom?: number;
  /** Fit these bounds instead of flying to a point. */
  bounds?: [[number, number], [number, number]];
}

export interface MapViewport {
  bbox: BoundingBox;
  zoom: number;
}

interface MapViewProps {
  earthquakes: Earthquake[];
  selected: Earthquake | null;
  facilities: Facility[];
  analysis: GapAnalysis | null;
  layers: LayerVisibility;
  settings: MapSettings;
  radii: readonly number[];
  selectedFacility: Facility | null;
  route: [number, number][] | null;
  focus: FocusRequest | null;
  resetSignal: number;
  onSelect: (id: string) => void;
  onSelectFacility: (id: string | null) => void;
  onViewportChange: (viewport: MapViewport) => void;
  onStyleChange: (style: ResolvedMapStyle) => void;
  onReadyChange: (state: "loading" | "ready" | "error") => void;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c] ?? c);
}

function setSourceData(map: maplibregl.Map, id: string, data: GeoJSON.GeoJSON) {
  (map.getSource(id) as GeoJSONSource | undefined)?.setData(data);
}

/** Approximate bounds of a circle of radiusKm around a point, for fitBounds. */
function boundsAround(lng: number, lat: number, radiusKm: number): maplibregl.LngLatBoundsLike {
  const dLat = radiusKm / 111.2;
  const dLng = radiusKm / (111.2 * Math.max(Math.cos((lat * Math.PI) / 180), 0.05));
  return [
    [lng - dLng, Math.max(lat - dLat, -85)],
    [lng + dLng, Math.min(lat + dLat, 85)],
  ];
}

function quakePopupHtml(p: Record<string, unknown>): string {
  const severity = SEVERITY_BY_ID[p.severity as SeverityLevel] ?? SEVERITY_BY_ID.minor;
  const depth = Number(p.depth);
  return `<div class="gr-popup-head"><span class="gr-mag" style="color:${severity.color};border-color:${severity.color}55;background:${severity.color}14">${formatMagnitude(
    Number(p.mag),
  )}</span><div><div class="gr-popup-kicker" style="color:${severity.color}">${severity.label} earthquake</div><div class="gr-popup-title">${escapeHtml(
    String(p.place),
  )}</div></div></div><div class="gr-popup-grid"><span>When</span><span>${formatRelative(Number(p.time))}</span><span>Depth</span><span>${depth.toFixed(
    1,
  )} km · ${depthClass(depth).label.toLowerCase()}</span></div><div class="gr-popup-hint">Click to analyze response coverage</div>`;
}

function MapViewImpl(props: MapViewProps) {
  const { selected, facilities, analysis, layers, settings, radii, selectedFacility, route, focus, resetSignal } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const pulseRef = useRef<maplibregl.Marker | null>(null);
  const [styleVersion, setStyleVersion] = useState(0);
  const styleReady = styleVersion > 0;

  // Latest props, readable from MapLibre event handlers and style reloads.
  const latest = useRef(props);
  latest.current = props;

  // GeoJSON is built once per data change and shared by the plain and clustered sources.
  const earthquakeData = useMemo(() => earthquakesToGeoJSON(props.earthquakes), [props.earthquakes]);
  /** Which GeoJSON object the clustered source currently holds (it is only refreshed in clusters mode). */
  const clusteredDataRef = useRef<unknown>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let style = resolveMapStyle();
    let loaded = false;
    latest.current.onStyleChange(style);
    latest.current.onReadyChange("loading");

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: style.url,
      transformRequest: style.transformRequest,
      bounds: INITIAL_BOUNDS,
      fitBoundsOptions: { padding: 24 },
      minZoom: 0,
      maxZoom: 17,
      dragRotate: false,
      pitchWithRotate: false,
      attributionControl: false,
    });
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric", maxWidth: 110 }), "bottom-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    let fallbackPending = false;
    const switchToFallback = () => {
      loaded = false;
      style = fallbackMapStyle();
      latest.current.onStyleChange(style);
      map.setStyle(style.url, { diff: false });
    };

    map.on("error", (event) => {
      const error = event.error as { name?: string; message?: string; status?: number } | undefined;
      if (error?.name === "AbortError") return; // cancelled requests during a style switch
      const status = error?.status;
      const authFailure = status === 401 || status === 403;
      if (style.provider === "amazon-location" && (!loaded || authFailure)) {
        if (fallbackPending) return;
        fallbackPending = true;
        console.warn("Amazon Location basemap unavailable, switching to the open fallback basemap.", error?.message);
        // A rejected API key still returns the style descriptor, so tile 401/403s also trigger the fallback.
        // Switch once pending requests settle to avoid aborting them mid-flight.
        if (loaded) map.once("idle", switchToFallback);
        else switchToFallback();
        return;
      }
      if (!loaded) latest.current.onReadyChange("error");
      // Individual tile errors after the style loaded are non-fatal.
    });

    let firstLoad = true;
    map.on("style.load", () => {
      loaded = true;
      if (firstLoad) {
        // Some provider styles carry their own camera; keep the global framing on first load.
        firstLoad = false;
        map.fitBounds(INITIAL_BOUNDS, { padding: 24, duration: 0 });
      }
      installLayers(map);
      clusteredDataRef.current = null;
      // A new version re-runs every data effect, repopulating the fresh sources.
      setStyleVersion((v) => v + 1);
      latest.current.onReadyChange("ready");
    });

    // Earthquake interactions (individual and clustered point layers)
    const hoverPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14, className: "gr-popup", maxWidth: "280px" });
    for (const layer of EARTHQUAKE_POINT_LAYERS) {
      map.on("click", layer, (e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id) latest.current.onSelect(id);
      });
      map.on("mousemove", layer, (e) => {
        map.getCanvas().style.cursor = "pointer";
        const feature = e.features?.[0] as MapGeoJSONFeature | undefined;
        if (!feature) return;
        const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
        hoverPopup.setLngLat([lng, lat]).setHTML(quakePopupHtml(feature.properties)).addTo(map);
      });
      map.on("mouseleave", layer, () => {
        map.getCanvas().style.cursor = "";
        hoverPopup.remove();
      });
    }
    map.on("click", LAYERS.clusters, async (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const source = map.getSource(SOURCES.earthquakesClustered) as GeoJSONSource;
      const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id as number);
      const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
      map.easeTo({ center: [lng, lat], zoom: Math.min(zoom + 0.5, 12), duration: 600 });
    });
    map.on("mouseenter", LAYERS.clusters, () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", LAYERS.clusters, () => (map.getCanvas().style.cursor = ""));

    // Facility selection opens the facility details card.
    map.on("click", LAYERS.facilities, (e) => {
      const id = e.features?.[0]?.properties?.id as string | undefined;
      if (id) latest.current.onSelectFacility(id);
    });
    map.on("mouseenter", LAYERS.facilities, () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", LAYERS.facilities, () => (map.getCanvas().style.cursor = ""));

    const emitViewport = () => {
      const b = map.getBounds();
      latest.current.onViewportChange({
        zoom: map.getZoom(),
        bbox: { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() },
      });
    };
    map.on("moveend", emitViewport);
    map.once("load", emitViewport);

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      hoverPopup.remove();
      pulseRef.current?.remove();
      pulseRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Earthquakes: the plain source feeds markers and the heatmap; the clustered source is only refreshed in clusters mode.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    setSourceData(map, SOURCES.earthquakes, earthquakeData);
    if (settings.displayMode === "clusters" && clusteredDataRef.current !== earthquakeData) {
      setSourceData(map, SOURCES.earthquakesClustered, earthquakeData);
      clusteredDataRef.current = earthquakeData;
    }
  }, [earthquakeData, settings.displayMode, styleReady, styleVersion]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && styleReady) applyMapSettings(map, layers, settings);
  }, [layers, settings, styleReady, styleVersion]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && styleReady) setSourceData(map, SOURCES.facilities, facilitiesToGeoJSON(facilities));
  }, [facilities, styleReady, styleVersion]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && styleReady) setSourceData(map, SOURCES.selectedFacility, pointToGeoJSON(selectedFacility));
  }, [selectedFacility, styleReady, styleVersion]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && styleReady) setSourceData(map, SOURCES.route, routeToGeoJSON(route));
  }, [route, styleReady, styleVersion]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    setSourceData(map, SOURCES.selected, selectedToGeoJSON(selected));
    setSourceData(map, SOURCES.rings, ringsToGeoJSON(selected, radii));
    setSourceData(map, SOURCES.ringLabels, ringLabelsToGeoJSON(selected, radii));
  }, [selected, radii, styleReady, styleVersion]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && styleReady) setSourceData(map, SOURCES.nearest, nearestLineToGeoJSON(selected, analysis));
  }, [selected, analysis, styleReady, styleVersion]);

  // Pulsing DOM marker that makes the selected epicenter easy to spot at any zoom.
  useEffect(() => {
    const map = mapRef.current;
    pulseRef.current?.remove();
    pulseRef.current = null;
    if (!map || !selected) return;
    const el = document.createElement("div");
    el.className = "gr-pulse";
    el.style.setProperty("--pulse-color", SEVERITY_BY_ID[selected.severity].color);
    el.setAttribute("aria-hidden", "true");
    pulseRef.current = new maplibregl.Marker({ element: el }).setLngLat([selected.longitude, selected.latitude]).addTo(map);
  }, [selected]);

  // Fly to a newly selected earthquake, framing the outermost analysis radius.
  const selectedId = selected?.id;
  useEffect(() => {
    const map = mapRef.current;
    const sel = latest.current.selected;
    if (!map || !sel) return;
    const radiusKm = Math.min(Math.max(...latest.current.radii, 10), FACILITY_SEARCH_RADIUS_KM) * 1.15;
    map.fitBounds(boundsAround(sel.longitude, sel.latitude, radiusKm), { padding: 40, maxZoom: 11, duration: 1600, essential: true });
  }, [selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    if (focus.bounds) {
      map.fitBounds(focus.bounds, { padding: 60, maxZoom: 9, duration: 1400 });
    } else if (focus.longitude !== undefined && focus.latitude !== undefined) {
      map.flyTo({ center: [focus.longitude, focus.latitude], zoom: focus.zoom ?? Math.max(map.getZoom(), 12), duration: 1200 });
    }
  }, [focus]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || resetSignal === 0) return;
    map.fitBounds(INITIAL_BOUNDS, { padding: 24, duration: 1200 });
  }, [resetSignal]);

  return <div ref={containerRef} className="absolute inset-0" role="region" aria-label="Interactive earthquake map" />;
}

/** Memoized: the map only re-renders when its own inputs change, not on unrelated app state. */
export const MapView = memo(MapViewImpl);
