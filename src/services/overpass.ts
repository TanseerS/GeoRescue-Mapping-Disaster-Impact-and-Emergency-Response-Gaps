import { env } from "../config/env";
import type {
  Facility,
  FacilityKind,
  FacilityQuery,
  OverpassElement,
  OverpassResponse,
} from "../types/facility";

const REQUEST_TIMEOUT_MS = 30_000;

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
  return `[out:json][timeout:25];
(
  nwr["amenity"="hospital"]${area};
  nwr["healthcare"="hospital"]${area};
  nwr["amenity"="fire_station"]${area};
  nwr["emergency"="ambulance_station"]${area};
  nwr["amenity"="police"]${area};
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

async function postQuery(endpoint: string, body: string, signal?: AbortSignal): Promise<OverpassResponse> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: `data=${encodeURIComponent(body)}`,
      signal: controller.signal,
    });
    if (response.status === 429) throw new Error("Overpass API rate limit reached");
    if (!response.ok) throw new Error(`Overpass API responded with HTTP ${response.status}`);
    return (await response.json()) as OverpassResponse;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * Fetches hospitals and emergency facilities from OpenStreetMap via the Overpass API,
 * trying each configured endpoint in order until one succeeds.
 */
export async function fetchFacilities(query: FacilityQuery, signal?: AbortSignal): Promise<Facility[]> {
  const body = buildOverpassQuery(query);
  let lastError: Error | null = null;
  for (const endpoint of env.overpassEndpoints) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      const data = await postQuery(endpoint, body, signal);
      return parseOverpassElements(data.elements ?? []);
    } catch (err) {
      if (signal?.aborted) throw err;
      lastError = err as Error;
    }
  }
  const reason = lastError?.name === "AbortError" ? "the request timed out" : lastError?.message ?? "unknown error";
  throw new Error(`OpenStreetMap facility service is unavailable (${reason}). Please retry in a moment.`);
}
