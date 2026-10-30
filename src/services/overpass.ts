import { env } from "../config/env";
import type {
  Facility,
  FacilityKind,
  FacilityQuery,
  OverpassElement,
  OverpassResponse,
} from "../types/facility";

/** Per-endpoint budget. Public Overpass instances can be slow under load. */
const REQUEST_TIMEOUT_MS = 55_000;
/** Start the next mirror if the current one has not answered within this delay. */
const HEDGE_DELAY_MS = 8_000;

/** Overpass area filter for a radius or bounding-box query. */
function areaFilter(query: FacilityQuery): string {
  if (query.type === "radius") {
    const meters = Math.round(query.radiusKm * 1000);
    return `(around:${meters},${query.latitude.toFixed(5)},${query.longitude.toFixed(5)})`;
  }
  const { south, west, north, east } = query.bbox;
  return `(${south.toFixed(5)},${west.toFixed(5)},${north.toFixed(5)},${east.toFixed(5)})`;
}

export function buildOverpassQuery(query: FacilityQuery): string {
  const area = areaFilter(query);
  return `[out:json][timeout:50];
(
  nwr["amenity"~"^(hospital|fire_station|police)$"]${area};
  nwr["healthcare"="hospital"]${area};
  nwr["emergency"="ambulance_station"]${area};
);
out center tags;`;
}

export function facilityQueryKey(query: FacilityQuery): string {
  if (query.type === "radius") {
    return `r:${query.latitude.toFixed(4)},${query.longitude.toFixed(4)},${query.radiusKm}`;
  }
  const b = query.bbox;
  return `b:${b.south.toFixed(3)},${b.west.toFixed(3)},${b.north.toFixed(3)},${b.east.toFixed(3)}`;
}

function classify(tags: Record<string, string>): FacilityKind | null {
  if (tags.amenity === "hospital" || tags.healthcare === "hospital") return "hospital";
  if (tags.amenity === "fire_station") return "fire_station";
  if (tags.emergency === "ambulance_station") return "ambulance_station";
  if (tags.amenity === "police") return "police";
  return null;
}

const KIND_FALLBACK_NAME: Record<FacilityKind, string> = {
  hospital: "Unnamed hospital",
  fire_station: "Unnamed fire station",
  police: "Unnamed police station",
  ambulance_station: "Unnamed ambulance station",
};

export function parseOverpassElements(elements: OverpassElement[]): Facility[] {
  const seen = new Set<string>();
  const facilities: Facility[] = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    const kind = classify(tags);
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!kind || lat === undefined || lon === undefined) continue;
    const id = `${el.type}/${el.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const emergencyTag = tags.emergency;
    facilities.push({
      id,
      name: tags.name || tags["name:en"] || tags.operator || KIND_FALLBACK_NAME[kind],
      kind,
      category: kind === "hospital" ? "hospital" : "emergency",
      latitude: lat,
      longitude: lon,
      hasEmergencyDept: kind === "hospital" && emergencyTag ? emergencyTag === "yes" : null,
      osmUrl: `https://www.openstreetmap.org/${id}`,
    });
  }
  return facilities;
}

async function postQuery(endpoint: string, body: string, signal: AbortSignal): Promise<OverpassResponse> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", Accept: "application/json" },
    body: `data=${encodeURIComponent(body)}`,
    signal,
  });
  if (response.status === 429) throw new Error("rate limit reached");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as OverpassResponse;
}

/**
 * Fetches hospitals and emergency facilities from OpenStreetMap via the Overpass API.
 * Requests are hedged across the configured mirrors: the next mirror starts when the current
 * one fails or is slow, the first successful response wins and the rest are cancelled.
 */
export function fetchFacilities(query: FacilityQuery, signal?: AbortSignal): Promise<Facility[]> {
  const body = buildOverpassQuery(query);
  const endpoints = env.overpassEndpoints;

  return new Promise<Facility[]>((resolve, reject) => {
    const controllers: AbortController[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];
    const errors: string[] = [];
    let started = 0;
    let settled = false;

    const cleanup = () => {
      timers.forEach((t) => clearTimeout(t));
      controllers.forEach((c) => c.abort());
      signal?.removeEventListener("abort", onAbort);
    };
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };
    const onAbort = () => finish(() => reject(new DOMException("Aborted", "AbortError")));

    const startNext = () => {
      if (settled || started >= endpoints.length) return;
      const endpoint = endpoints[started];
      started += 1;
      const controller = new AbortController();
      controllers.push(controller);
      timers.push(setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS));
      timers.push(setTimeout(startNext, HEDGE_DELAY_MS));

      postQuery(endpoint, body, controller.signal)
        .then((data) => finish(() => resolve(parseOverpassElements(data.elements ?? []))))
        .catch((err: Error) => {
          if (settled) return;
          errors.push(err.name === "AbortError" ? "timed out" : err.message);
          if (errors.length >= endpoints.length) {
            const reason = [...new Set(errors)].join(", ");
            finish(() =>
              reject(new Error(`OpenStreetMap facility servers are busy or unreachable (${reason}). Please retry in a moment.`)),
            );
          } else {
            startNext();
          }
        });
    };

    if (signal?.aborted) return onAbort();
    signal?.addEventListener("abort", onAbort);
    if (endpoints.length === 0) return finish(() => reject(new Error("No Overpass API endpoint is configured.")));
    startNext();
  });
}
