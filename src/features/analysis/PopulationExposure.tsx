import { RefreshCw, Users } from "lucide-react";
import { Spinner } from "../../components/ui/Spinner";
import type { PopulationState } from "../../hooks/usePopulation";
import { formatPopulation } from "../../utils/intelligence";

interface PopulationExposureProps {
  state: PopulationState;
  onRetry: () => void;
}

/** Estimated residents within each radius (WorldPop via the GeoRescue API). */
export function PopulationExposure({ state, onRetry }: PopulationExposureProps) {
  if (state.status === "unavailable") {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-dashed border-white/[0.1] px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-400">
        <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Population exposure uses the WorldPop dataset through the GeoRescue AWS API (WorldPop cannot be queried from browsers
          directly). Set <code className="text-sky-200">VITE_API_BASE_URL</code> to enable it — locally,{" "}
          <code className="text-sky-200">npm run local</code> in <code className="text-sky-200">infrastructure/</code> works too.
        </span>
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-rose-500/20 bg-rose-500/[0.05] px-3 py-2 text-xs text-rose-200">
        <span>Population estimate unavailable: {state.error}</span>
        <button type="button" onClick={onRetry} className="inline-flex shrink-0 items-center gap-1 font-medium text-rose-100 hover:underline">
          <RefreshCw className="h-3 w-3" /> Retry
        </button>
      </div>
    );
  }
  if (state.status !== "success") {
    return (
      <p className="flex items-center gap-2 text-xs text-sky-200">
        <Spinner className="h-3.5 w-3.5" /> Estimating residents from WorldPop gridded population…
      </p>
    );
  }
  const { data } = state;
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {data.results.map((r) => (
          <div key={r.radiusKm} className="panel-muted px-2.5 py-2.5 text-center">
            <p className="num text-base font-semibold text-white">≈ {formatPopulation(r.population)}</p>
            <p className="text-[11px] text-ink-400">residents ≤ {r.radiusKm} km</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10.5px] leading-relaxed text-ink-500">
        {data.dataset} {data.year} ({data.resolution}, {data.license}). Modelled estimate of where people live, rounded to 3
        significant figures — not a casualty or impact estimate.{" "}
        <a href={data.sourceUrl} target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">
          Dataset
        </a>
      </p>
    </div>
  );
}
