import { useCallback, useMemo, useRef, useState } from "react";
import { facilityQueryKey, fetchFacilities } from "../services/overpass";
import type { Facility, FacilityQuery, FacilityResult } from "../types/facility";

export interface FacilityStore {
  results: Record<string, FacilityResult>;
  /** Unique facilities across every successful query in this session. */
  allFacilities: Facility[];
  /** Starts (or reuses) a query. Requests in the same group cancel each other. */
  request: (query: FacilityQuery, group: string, force?: boolean) => string;
}

export function useFacilities(): FacilityStore {
  const [results, setResults] = useState<Record<string, FacilityResult>>({});
  const resultsRef = useRef(results);
  resultsRef.current = results;
  const inFlight = useRef(new Map<string, { key: string; controller: AbortController }>());

  const update = (key: string, patch: Partial<FacilityResult>) =>
    setResults((prev) => {
      const base: FacilityResult = prev[key] ?? { key, status: "idle", facilities: [], error: null, fetchedAt: null };
      return { ...prev, [key]: { ...base, ...patch } };
    });

  const request = useCallback((query: FacilityQuery, group: string, force = false) => {
    const key = facilityQueryKey(query);
    const existing = resultsRef.current[key];
    const current = inFlight.current.get(group);

    if (!force && existing && (existing.status === "success" || existing.status === "loading")) {
      if (current && current.key !== key) {
        current.controller.abort();
        inFlight.current.delete(group);
        update(current.key, { status: "idle" });
      }
      return key;
    }

    if (current) {
      current.controller.abort();
      if (current.key !== key) update(current.key, { status: "idle" });
    }
    const controller = new AbortController();
    inFlight.current.set(group, { key, controller });
    update(key, { status: "loading", error: null });

    fetchFacilities(query, controller.signal)
      .then((facilities) => {
        if (controller.signal.aborted) return;
        update(key, { status: "success", facilities, fetchedAt: Date.now() });
      })
      .catch((err: Error) => {
        if (controller.signal.aborted) return;
        update(key, { status: "error", error: err.message });
      })
      .finally(() => {
        if (inFlight.current.get(group)?.controller === controller) inFlight.current.delete(group);
      });

    return key;
  }, []);

  const allFacilities = useMemo(() => {
    const byId = new Map<string, Facility>();
    Object.values(results).forEach((r) => r.facilities.forEach((f) => byId.set(f.id, f)));
    return [...byId.values()];
  }, [results]);

  return { results, allFacilities, request };
}
