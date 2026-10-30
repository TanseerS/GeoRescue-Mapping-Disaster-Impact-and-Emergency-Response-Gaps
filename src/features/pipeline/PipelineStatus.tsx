import { CheckCircle2, CircleDashed, Cloud, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Spinner } from "../../components/ui/Spinner";
import { env, isAwsApiConfigured } from "../../config/env";
import { fetchIngestionStatus, type IngestionStatus } from "../../services/earthquakeApi";
import type { DataSource } from "../../types/earthquake";
import { formatDateTime, formatNumber, formatRelative } from "../../utils/format";

const STEPS = ["USGS feed", "EventBridge Scheduler", "Lambda ingestion", "Amazon S3", "Lambda API", "API Gateway"];

interface PipelineStatusProps {
  source: DataSource | null;
  fallbackReason: string | null;
}

/** Shows how earthquake data reaches the app and, when the AWS API is configured, its ingestion health. */
export function PipelineStatus({ source, fallbackReason }: PipelineStatusProps) {
  const configured = isAwsApiConfigured();
  const [status, setStatus] = useState<IngestionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    const controller = new AbortController();
    fetchIngestionStatus(env.apiBaseUrl, controller.signal)
      .then(setStatus)
      .catch((err: Error) => {
        if (!controller.signal.aborted) setError(err.message);
      });
    return () => controller.abort();
  }, [configured]);

  const last = status?.lastSuccessfulIngestion;
  const lastAt = status?.lastSuccessfulIngestionAt ? Date.parse(status.lastSuccessfulIngestionAt) : null;

  return (
    <div className="panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-300/10 text-orange-200">
            <Cloud className="h-4 w-4" />
          </span>
          <h3 className="font-display text-sm font-semibold text-white">Data pipeline · AWS serverless</h3>
        </div>
        <span className="text-xs text-ink-400">
          Active source:{" "}
          <span className="font-medium text-ink-100">
            {source === "aws-api" ? "GeoRescue AWS API" : source === "usgs-fallback" ? "USGS (fallback)" : "USGS direct"}
          </span>
        </span>
      </div>

      <ol className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px]" aria-label="Pipeline stages">
        {STEPS.map((step, i) => (
          <li key={step} className="flex items-center gap-1.5">
            <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-ink-200">{step}</span>
            {i < STEPS.length - 1 && <span className="text-ink-500" aria-hidden="true">→</span>}
          </li>
        ))}
      </ol>

      {!configured ? (
        <p className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-300">
          <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <span>
            Not connected. The browser reads the USGS feed directly. Deploy the SAM stack in
            <code className="mx-1 rounded bg-white/[0.06] px-1 py-0.5 text-[11.5px] text-sky-200">infrastructure/</code>
            and set <code className="mx-1 rounded bg-white/[0.06] px-1 py-0.5 text-[11.5px] text-sky-200">VITE_API_BASE_URL</code>
            to its <code className="rounded bg-white/[0.06] px-1 py-0.5 text-[11.5px] text-sky-200">ApiUrl</code> output.
          </span>
        </p>
      ) : (
        <div className="space-y-2 text-[13px] text-ink-300">
          <p className="break-all text-xs text-ink-400">
            API: <span className="text-ink-200">{env.apiBaseUrl}</span>
            {env.apiFallbackToUsgs ? " · falls back to USGS on failure" : " · fallback disabled"}
          </p>
          {fallbackReason && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-300/20 bg-amber-300/[0.05] px-3 py-2 text-xs text-amber-100">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Using USGS directly because: {fallbackReason}
            </p>
          )}
          {error ? (
            <p className="text-xs text-rose-300">Ingestion status unavailable: {error}</p>
          ) : !status ? (
            <p className="flex items-center gap-2 text-xs text-ink-400">
              <Spinner className="h-3.5 w-3.5" /> Loading ingestion status…
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="panel-muted px-3 py-2">
                <p className="label-xs !text-[10px]">Last ingestion</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-white" title={lastAt ? formatDateTime(lastAt) : undefined}>
                  {status.stale ? (
                    <TriangleAlert className="h-3.5 w-3.5 text-amber-300" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  )}
                  {lastAt ? formatRelative(lastAt) : "never"}
                </p>
                <p className="text-[11px] text-ink-400">{status.stale ? "Stale — check CloudWatch" : "Healthy"}</p>
              </div>
              <div className="panel-muted px-3 py-2">
                <p className="label-xs !text-[10px]">Stored events</p>
                <p className="num mt-1 text-sm font-semibold text-white">{last ? formatNumber(last.windowCount) : "—"}</p>
                <p className="text-[11px] text-ink-400">{status.windowDays}-day rolling window in S3</p>
              </div>
              <div className="panel-muted px-3 py-2">
                <p className="label-xs !text-[10px]">Last attempt</p>
                <p className="mt-1 text-sm font-medium capitalize text-white">{status.lastAttempt?.status ?? "—"}</p>
                <p className="truncate text-[11px] text-ink-400" title={status.lastAttempt?.error}>
                  {status.lastAttempt?.error ?? (last ? `${formatNumber(last.feedCount)} events in latest feed` : "")}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
