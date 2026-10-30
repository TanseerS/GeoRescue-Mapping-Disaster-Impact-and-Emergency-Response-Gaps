import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, MapGeoJSONFeature } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { useEffect, useRef, useState } from "react";
import { INITIAL_BOUNDS } from "../../config/constants";
import { fallbackMapStyle, resolveMapStyle, type ResolvedMapStyle } from "../../services/mapStyle";
import type { GapAnalysis } from "../../types/analysis";
import type { Earthquake } from "../../types/earthquake";
import type { BoundingBox, Facility } from "../../types/facility";
import type { LayerVisibility } from "../../types/ui";
import { formatDistance, formatMagnitude, formatRelative } from "../../utils/format";
import { distanceKm } from "../../utils/geo";
import {
  earthquakesToGeoJSON,
  facilitiesToGeoJSON,
  nearestLineToGeoJSON,
  ringsToGeoJSON,
  selectedToGeoJSON,
} from "./mapData";
import { applyLayerVisibility, installLayers, LAYERS, SOURCES } from "./mapLayers";

// MapLibre resolves its worker relative to its own module URL, which bundling breaks; point it at the emitted asset.
maplibregl.setWorkerUrl(maplibreWorkerUrl);

export interface FocusRequest {
  id: number;
  longitude: number;
  latitude: number;
  zoom?: number;
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
  focus: FocusRequest | null;
  resetSignal: number;
  onSelect: (id: string) => void;
  onViewportChange: (viewport: MapViewport) => void;
  onStyleChange: (style: ResolvedMapStyle) => void;
  onReadyChange: (state: "loading" | "ready" | "error") => void;
}

const KIND_LABEL: Record<string, string> = {
  hospital: "Hospital",
  fire_station: "Fire station",
  police: "Police station",
  ambulance_station: "Ambulance station",
};

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

export function MapView(props: MapViewProps) {
  const { earthquakes, selected, facilities, analysis, layers, focus, resetSignal } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [styleReady, setStyleReady] = useState(false);

  // Latest props, readable from MapLibre event handlers and style reloads.
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    if (!containerRef.current) return;
    let style = resolveMapStyle();
    let loaded = false;
    latest.current.onStyleChange(style);
    latest.current.onReadyChange("loading");

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: style.url,
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
      const p = latest.current;
      setSourceData(map, SOURCES.earthquakes, earthquakesToGeoJSON(p.earthquakes));
      setSourceData(map, SOURCES.facilities, facilitiesToGeoJSON(p.facilities));
      setSourceData(map, SOURCES.selected, selectedToGeoJSON(p.selected));
      setSourceData(map, SOURCES.rings, ringsToGeoJSON(p.selected));
      setSourceData(map, SOURCES.nearest, nearestLineToGeoJSON(p.selected, p.analysis));
      applyLayerVisibility(map, p.layers);
      setStyleReady(true);
      p.onReadyChange("ready");
    });

    // Earthquake interactions
    map.on("click", LAYERS.points, (e) => {
      const id = e.features?.[0]?.properties?.id as string | undefined;
      if (id) latest.current.onSelect(id);
    });
    map.on("click", LAYERS.clusters, async (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const source = map.getSource(SOURCES.earthquakes) as GeoJSONSource;
      const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id as number);
      const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
      map.easeTo({ center: [lng, lat], zoom: Math.min(zoom + 0.5, 12), duration: 600 });
    });

    const hoverPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, className: "gr-popup" });
    const showQuakePopup = (feature: MapGeoJSONFeature) => {
      const p = feature.properties;
      const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
      hoverPopup
        .setLngLat([lng, lat])
        .setHTML(
          `<div class="gr-popup-title"><span class="gr-dot" style="background:${p.color}"></span>M ${formatMagnitude(
            Number(p.mag),
          )}</div><div class="gr-popup-body">${escapeHtml(String(p.place))}</div><div class="gr-popup-meta">${formatRelative(
            Number(p.time),
          )} · ${Number(p.depth).toFixed(1)} km deep</div>`,
        )
        .addTo(map);
    };
    map.on("mousemove", LAYERS.points, (e) => {
      map.getCanvas().style.cursor = "pointer";
      if (e.features?.[0]) showQuakePopup(e.features[0]);
    });
    map.on("mouseleave", LAYERS.points, () => {
      map.getCanvas().style.cursor = "";
      hoverPopup.remove();
    });
    map.on("mouseenter", LAYERS.clusters, () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", LAYERS.clusters, () => (map.getCanvas().style.cursor = ""));

    // Facility interactions
    const facilityPopup = new maplibregl.Popup({ closeButton: true, offset: 14, className: "gr-popup", maxWidth: "260px" });
    map.on("click", LAYERS.facilities, (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const p = feature.properties;
      const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
      const sel = latest.current.selected;
      const dist = sel ? `<div class="gr-popup-meta">${formatDistance(distanceKm(sel, { longitude: lng, latitude: lat }))} from selected epicenter</div>` : "";
      facilityPopup
        .setLngLat([lng, lat])
        .setHTML(
          `<div class="gr-popup-kicker">${KIND_LABEL[String(p.kind)] ?? "Facility"}</div><div class="gr-popup-title">${escapeHtml(
            String(p.name),
          )}</div>${dist}<a class="gr-popup-link" href="${escapeHtml(String(p.osmUrl))}" target="_blank" rel="noreferrer">View on OpenStreetMap ↗</a>`,
        )
        .addTo(map);
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
      facilityPopup.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (map && styleReady) setSourceData(map, SOURCES.earthquakes, earthquakesToGeoJSON(earthquakes));
  }, [earthquakes, styleReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && styleReady) setSourceData(map, SOURCES.facilities, facilitiesToGeoJSON(facilities));
  }, [facilities, styleReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    setSourceData(map, SOURCES.selected, selectedToGeoJSON(selected));
    setSourceData(map, SOURCES.rings, ringsToGeoJSON(selected));
  }, [selected, styleReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && styleReady) setSourceData(map, SOURCES.nearest, nearestLineToGeoJSON(selected, analysis));
  }, [selected, analysis, styleReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && styleReady) applyLayerVisibility(map, layers);
  }, [layers, styleReady]);

  // Fly to a newly selected earthquake, framing the 50 km analysis radius.
  const selectedId = selected?.id;
  useEffect(() => {
    const map = mapRef.current;
    const sel = latest.current.selected;
    if (!map || !sel) return;
    map.fitBounds(boundsAround(sel.longitude, sel.latitude, 60), { padding: 40, maxZoom: 10, duration: 1400 });
  }, [selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    map.flyTo({ center: [focus.longitude, focus.latitude], zoom: focus.zoom ?? Math.max(map.getZoom(), 12), duration: 1200 });
  }, [focus]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || resetSignal === 0) return;
    map.fitBounds(INITIAL_BOUNDS, { padding: 24, duration: 1200 });
  }, [resetSignal]);

  return <div ref={containerRef} className="absolute inset-0" role="region" aria-label="Interactive earthquake map" />;
}
