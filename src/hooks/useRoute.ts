import { useCallback, useEffect, useRef, useState } from "react";
import { isRoutingConfigured } from "../config/env";
import { calculateRoute, type RouteResult } from "../services/routing";
import type { Earthquake } from "../types/earthquake";
import type { Facility } from "../types/facility";

export type RouteState =
  | { status: "idle" }
  | { status: "loading"; facilityId: string }
  | { status: "success"; facilityId: string; result: RouteResult }
  | { status: "error"; facilityId: string; error: string };

/** On-demand driving route from a facility to the selected epicenter (Amazon Location, optional). */
export function useRoute(selected: Earthquake | null) {
  const [state, setState] = useState<RouteState>({ status: "idle" });
  const controller = useRef<AbortController | null>(null);

  const clear = useCallback(() => {
    controller.current?.abort();
    setState({ status: "idle" });
  }, []);

  // A route belongs to one epicenter; drop it when the selection changes.
  useEffect(() => clear, [selected?.id, clear]);

  const request = useCallback(
    (facility: Facility) => {
      if (!selected || !isRoutingConfigured()) return;
      controller.current?.abort();
      const ctrl = new AbortController();
      controller.current = ctrl;
      setState({ status: "loading", facilityId: facility.id });
      calculateRoute(facility, selected, ctrl.signal)
        .then((result) => setState({ status: "success", facilityId: facility.id, result }))
        .catch((err: Error) => {
          if (!ctrl.signal.aborted) setState({ status: "error", facilityId: facility.id, error: err.message });
        });
    },
    [selected],
  );

  return { state, request, clear, enabled: isRoutingConfigured() };
}
