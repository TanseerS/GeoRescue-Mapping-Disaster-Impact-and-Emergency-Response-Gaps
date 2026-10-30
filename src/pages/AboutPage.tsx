import { Activity, Building2, CheckCircle2, CircleDashed, Cloud, Github, ShieldAlert, X } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "../components/Logo";
import { IconButton } from "../components/ui/Button";
import { ANALYSIS_RADII_KM, FACILITY_SEARCH_RADIUS_KM, SEVERITIES, SIGNIFICANT_MAGNITUDE } from "../config/constants";
import { env, isAwsMapConfigured } from "../config/env";
import { PipelineStatus } from "../features/pipeline/PipelineStatus";
import type { ResolvedMapStyle } from "../services/mapStyle";
import type { DataSource } from "../types/earthquake";

const REPO_URL = "https://github.com/TanseerS/GeoRescue-Mapping-Disaster-Impact-and-Emergency-Response-Gaps";

function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="panel p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-400/10 text-sky-300">{icon}</span>
        <h3 className="font-display text-sm font-semibold text-white">{title}</h3>
      </div>
      <div className="space-y-2 text-[13px] leading-relaxed text-ink-300">{children}</div>
    </div>
  );
}

interface AboutPageProps {
  mapStyle: ResolvedMapStyle | null;
  source: DataSource | null;
  fallbackReason: string | null;
  onClose: () => void;
}

export function AboutPage({ mapStyle, source, fallbackReason, onClose }: AboutPageProps) {
  const awsConfigured = isAwsMapConfigured();
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-ink-950/95 backdrop-blur-sm scrollbar-thin animate-fade-in">
      <div className="bg-grid min-h-full">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Logo className="h-12 w-12" />
              <div>
                <p className="label-xs">About</p>
                <h2 className="font-display text-2xl font-semibold tracking-tight text-white">GeoRescue</h2>
                <p className="text-sm text-ink-400">Mapping Disaster Impact and Emergency Response Gaps</p>
              </div>
            </div>
            <IconButton label="Close About and return to the map" onClick={onClose}>
              <X className="h-4 w-4" />
            </IconButton>
          </div>

          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-ink-200">
            GeoRescue combines live seismic data with openly mapped emergency infrastructure to show where earthquakes are
            happening and how close the nearest hospitals and emergency services are. It helps analysts and responders
            quickly spot events that deserve further investigation.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <Card icon={<Activity className="h-4 w-4" />} title="Earthquake data · USGS">
              <p>
                Live GeoJSON summary feeds from the U.S. Geological Survey (past 24 hours, 7 days and 30 days), refreshed
                automatically every 5 minutes. Coordinates, magnitude, depth, time and location descriptions come directly
                from USGS; records without a magnitude or location are excluded rather than estimated. When the AWS pipeline
                is connected, the same feed is ingested into Amazon S3 every 5 minutes and served through API Gateway.
              </p>
            </Card>
            <Card icon={<Building2 className="h-4 w-4" />} title="Facilities · OpenStreetMap">
              <p>
                Hospitals, clinics, fire stations, ambulance stations and police stations are queried on demand from the
                Overpass API around a selected epicenter (within {FACILITY_SEARCH_RADIUS_KM} km) or across the visible map area.
                No facility data is fabricated — if the service is unavailable, GeoRescue shows a retry state.
              </p>
            </Card>
            <Card icon={<ShieldAlert className="h-4 w-4" />} title="Methodology">
              <p>Severity bands follow USGS feed thresholds:</p>
              <ul className="space-y-1">
                {SEVERITIES.map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-ink-200">{s.label}</span>
                    <span className="num text-xs text-ink-400">M {s.range}</span>
                  </li>
                ))}
              </ul>
              <p>
                “Significant” counts events of magnitude {SIGNIFICANT_MAGNITUDE}+. Gap analysis uses Turf.js great-circle
                distances to count each facility type within three configurable radii (default {ANALYSIS_RADII_KM.join(" / ")} km),
                find the nearest mapped hospital and fire station, and classify coverage by nearest-hospital distance.
              </p>
            </Card>
            <Card icon={<Cloud className="h-4 w-4" />} title="Map · Amazon Location Service">
              <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                {awsConfigured ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <CircleDashed className="h-4 w-4 shrink-0 text-amber-300" />
                )}
                <span className="text-xs text-ink-200">
                  {awsConfigured
                    ? `Configured · ${env.aws.mapStyle} style in ${env.aws.region}`
                    : "Not configured · using open fallback basemap"}
                </span>
              </div>
              <p>
                Active basemap: <span className="text-ink-100">{mapStyle?.label ?? "loading…"}</span>. Set
                <code className="mx-1 rounded bg-white/[0.06] px-1 py-0.5 text-[11.5px] text-sky-200">VITE_AWS_LOCATION_API_KEY</code>
                and region to render Amazon Location maps. If the AWS style cannot load, GeoRescue falls back automatically.
              </p>
            </Card>
          </div>

          <div className="mt-3">
            <PipelineStatus source={source} fallbackReason={fallbackReason} />
          </div>

          <div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-4 text-[13px] leading-relaxed text-amber-100/85">
            <p className="mb-1 font-semibold text-amber-200">Important limitations</p>
            Proximity is an estimate. Straight-line distance does not account for roads, terrain, travel time, damage,
            facility capacity, staffing or real-time availability. OpenStreetMap coverage varies widely by region, so the
            absence of a mapped facility does not prove none exists. Population exposure figures are modelled WorldPop 2020
            estimates of residents — not casualty, damage or real-time presence estimates. GeoRescue is a decision-support
            visualization, not an emergency dispatch or alerting system.
          </div>

          <p className="mt-3 text-[11.5px] leading-relaxed text-ink-500">
            Data attribution: earthquakes courtesy of the U.S. Geological Survey · facilities © OpenStreetMap contributors (ODbL)
            · population © WorldPop (www.worldpop.org), CC BY 4.0 · basemap © CARTO / OpenStreetMap contributors or © AWS / HERE
            via Amazon Location Service.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-400">
            <span>Built with React, TypeScript, MapLibre GL JS, Turf.js and Recharts.</span>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sky-300 hover:text-sky-200">
              <Github className="h-3.5 w-3.5" /> Source on GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
