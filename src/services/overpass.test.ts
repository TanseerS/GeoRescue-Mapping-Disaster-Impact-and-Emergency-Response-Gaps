import { afterEach, describe, expect, it, vi } from "vitest";
import { buildOverpassQuery, facilityQueryKey, fetchFacilities, parseOverpassElements } from "./overpass";

describe("overpass service", () => {
  it("builds a radius query in meters", () => {
    const q = buildOverpassQuery({ type: "radius", latitude: 35.1, longitude: 139.2, radiusKm: 50 });
    expect(q).toContain("around:50000,35.10000,139.20000");
    expect(q).toContain("\"amenity\"~\"^(hospital|fire_station|police)$\"");
    expect(q).toContain("out center tags;");
  });

  it("builds a bounding box query", () => {
    const q = buildOverpassQuery({ type: "bbox", bbox: { south: 1, west: 2, north: 3, east: 4 } });
    expect(q).toContain("(1.00000,2.00000,3.00000,4.00000)");
    expect(facilityQueryKey({ type: "bbox", bbox: { south: 1, west: 2, north: 3, east: 4 } })).toBe(
      "b:1.000,2.000,3.000,4.000",
    );
  });

  it("parses and classifies nodes and ways, dropping duplicates and unlocated elements", () => {
    const facilities = parseOverpassElements([
      { type: "node", id: 1, lat: 10, lon: 20, tags: { amenity: "hospital", name: "General", emergency: "yes" } },
      { type: "way", id: 2, center: { lat: 11, lon: 21 }, tags: { amenity: "fire_station" } },
      { type: "node", id: 1, lat: 10, lon: 20, tags: { amenity: "hospital" } },
      { type: "relation", id: 3, tags: { amenity: "police" } },
      { type: "node", id: 4, lat: 12, lon: 22, tags: { emergency: "ambulance_station", name: "Med 1" } },
      { type: "node", id: 5, lat: 12, lon: 22, tags: { shop: "bakery" } },
    ]);
    expect(facilities).toHaveLength(3);
    expect(facilities[0]).toMatchObject({ id: "node/1", kind: "hospital", category: "hospital", hasEmergencyDept: true });
    expect(facilities[1]).toMatchObject({ id: "way/2", kind: "fire_station", category: "emergency", name: "Unnamed fire station" });
    expect(facilities[2]).toMatchObject({ kind: "ambulance_station", category: "emergency" });
  });
});

describe("fetchFacilities failover", () => {
  const okBody = { elements: [{ type: "node", id: 9, lat: 1, lon: 2, tags: { amenity: "hospital", name: "Mirror" } }] };
  const query = { type: "radius", latitude: 1, longitude: 2, radiusKm: 50 } as const;

  afterEach(() => vi.unstubAllGlobals());

  it("falls through to the next mirror when the first fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(okBody), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const facilities = await fetchFacilities(query);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(facilities[0]).toMatchObject({ id: "node/9", name: "Mirror" });
  });

  it("reports an error when every mirror fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response("", { status: 429 })));
    await expect(fetchFacilities(query)).rejects.toThrow(/busy or unreachable/);
  });
});
