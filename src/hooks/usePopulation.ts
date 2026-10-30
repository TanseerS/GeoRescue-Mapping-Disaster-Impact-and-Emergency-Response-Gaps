import { useEffect, useState } from "react";
import { env, isAwsApiConfigured } from "../config/env";
import { fetchPopulation, type PopulationResponse } from "../services/population";
import type { Earthquake } from "../types/earthquake";

export type PopulationState =
  | { status: "unavailable" }
  | { status: "idle" | "loading" }
  | { status: "success"; data: PopulationResponse }
  | { status: "error"; error: string };

/** Loads WorldPop exposure estimates for the selected epicenter (requires the GeoRescue API). */
export function usePopulation(selected: Earthquake | null, radii: readonly number[], attempt: number): PopulationState {
  const available = isAwsApiConfigured();
  const [state, setState] = useState<PopulationState>(available ? { status: "idle" } : { status: "unavailable" });
  const radiiKey = radii.join(",");

  useEffect(() => {
    if (!available) return;
    if (!selected) {
      setState({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    setState({ status: "loading" });
    fetchPopulation(env.apiBaseUrl, selected.latitude, selected.longitude, radiiKey.split(",").map(Number), controller.signal)
      .then((data) => setState({ status: "success", data }))
      .catch((err: Error) => {
        if (!controller.signal.aborted) setState({ status: "error", error: err.message });
      });
    return () => controller.abort();
    // Keyed on the epicenter and radii rather than the event object, which is replaced on every feed refresh.
  }, [available, selected?.id, selected?.latitude, selected?.longitude, radiiKey, attempt]);

  return state;
}
