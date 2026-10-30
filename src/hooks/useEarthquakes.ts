import { useCallback, useEffect, useRef, useState } from "react";
import { AUTO_REFRESH_MS } from "../config/constants";
import { loadEarthquakes } from "../services/earthquakeSource";
import type { EarthquakeFeed, TimeRange } from "../types/earthquake";

export type FeedStatus = "loading" | "refreshing" | "ready" | "error";

export interface EarthquakeState {
  feed: EarthquakeFeed | null;
  status: FeedStatus;
  error: string | null;
  refresh: () => void;
}

/**
 * Loads the USGS summary feed for a time range, caches each range in memory so switching
 * back is instant, and refreshes the active feed periodically.
 */
export function useEarthquakes(range: TimeRange): EarthquakeState {
  const cache = useRef(new Map<TimeRange, EarthquakeFeed>());
  const controller = useRef<AbortController | null>(null);
  const [feed, setFeed] = useState<EarthquakeFeed | null>(null);
  const [status, setStatus] = useState<FeedStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (force: boolean) => {
      const cached = cache.current.get(range);
      const fresh = cached && Date.now() - cached.fetchedAt < AUTO_REFRESH_MS;
      if (cached) setFeed(cached);
      if (cached && fresh && !force) {
        setStatus("ready");
        setError(null);
        return;
      }

      controller.current?.abort();
      const ctrl = new AbortController();
      controller.current = ctrl;
      setStatus(cached ? "refreshing" : "loading");
      if (!cached) setFeed(null);

      try {
        const result = await loadEarthquakes(range, ctrl.signal);
        if (ctrl.signal.aborted) return;
        cache.current.set(range, result);
        setFeed(result);
        setStatus("ready");
        setError(null);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setError((err as Error).message);
        setStatus("error");
      }
    },
    [range],
  );

  useEffect(() => {
    void load(false);
    const timer = window.setInterval(() => void load(true), AUTO_REFRESH_MS);
    return () => {
      window.clearInterval(timer);
      controller.current?.abort();
    };
  }, [load]);

  const refresh = useCallback(() => void load(true), [load]);

  return { feed, status, error, refresh };
}
