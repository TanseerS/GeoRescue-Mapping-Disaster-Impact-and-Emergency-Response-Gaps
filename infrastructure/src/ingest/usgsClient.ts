import { validateFeed, type ValidatedFeed } from "../shared/geojson";
import type { Logger } from "../shared/logger";

export type FetchLike = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export interface FetchFeedOptions {
  fetch?: FetchLike;
  attempts?: number;
  timeoutMs?: number;
  /** Base delay for exponential backoff between attempts. */
  backoffMs?: number;
  logger?: Logger;
  sleep?: (ms: number) => Promise<void>;
}

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Fetches and validates a USGS GeoJSON summary feed. Network errors, timeouts, HTTP 429 and
 * 5xx responses are retried with exponential backoff; other 4xx and invalid payloads fail fast.
 */
export async function fetchUsgsFeed(url: string, options: FetchFeedOptions = {}): Promise<ValidatedFeed> {
  const { attempts = 3, timeoutMs = 15_000, backoffMs = 1_000, logger, sleep = defaultSleep } = options;
  const doFetch: FetchLike = options.fetch ?? (globalThis.fetch as unknown as FetchLike);
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await doFetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Accept: "application/geo+json, application/json", "User-Agent": "GeoRescue-Ingestion/1.0" },
      });
      if (!res.ok) {
        const retryable = res.status === 429 || res.status >= 500;
        throw new UpstreamError(`USGS responded with HTTP ${res.status}`, retryable);
      }
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        throw new UpstreamError("USGS response was not valid JSON", true);
      }
      return validateFeed(body);
    } catch (err) {
      const error = err as Error;
      const retryable = error instanceof UpstreamError ? error.retryable : error.name !== "FeedValidationError";
      lastError = error;
      logger?.warn("usgs.fetch.failed", { url, attempt, attempts, retryable, error: error.message });
      if (!retryable || attempt === attempts) break;
      await sleep(backoffMs * 2 ** (attempt - 1));
    }
  }
  throw lastError ?? new Error("USGS fetch failed");
}
