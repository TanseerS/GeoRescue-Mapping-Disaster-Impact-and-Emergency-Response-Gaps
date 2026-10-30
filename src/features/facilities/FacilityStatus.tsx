import { CloudOff, RefreshCw } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Spinner } from "../../components/ui/Spinner";
import { useNow } from "../../hooks/useNow";
import type { FacilityResult } from "../../types/facility";

/** Loading / error states shared by every panel that depends on an Overpass query. */
export function FacilityStatus({ result, onRetry }: { result: FacilityResult | undefined; onRetry: () => void }) {
  const now = useNow(1000);
  if (!result || result.status === "loading" || result.status === "idle") {
    const elapsed = result?.requestedAt ? Math.max(0, Math.floor((now - result.requestedAt) / 1000)) : 0;
    return (
      <div className="space-y-2" aria-busy="true">
        <div className="flex items-center gap-2 text-xs text-sky-200">
          <Spinner className="h-3.5 w-3.5" /> Querying OpenStreetMap for nearby facilities…
          {elapsed > 0 && <span className="num ml-auto text-ink-400">{elapsed}s</span>}
        </div>
        {elapsed >= 10 && (
          <p className="text-[11px] leading-snug text-ink-400">
            Public Overpass servers can be slow under load. GeoRescue is trying alternate mirrors.
          </p>
        )}
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="h-7 w-7 animate-pulse rounded-md bg-white/[0.06]" />
            <div className="flex-1 space-y-1.5">
              <div className="h-2.5 w-3/4 animate-pulse rounded bg-white/[0.06]" />
              <div className="h-2 w-1/3 animate-pulse rounded bg-white/[0.04]" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (result.status === "error") {
    return (
      <EmptyState
        tone="error"
        icon={<CloudOff className="h-5 w-5" />}
        title="Facility data unavailable"
        description={result.error}
        action={
          <Button size="sm" variant="secondary" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={onRetry}>
            Retry query
          </Button>
        }
      />
    );
  }
  return null;
}
