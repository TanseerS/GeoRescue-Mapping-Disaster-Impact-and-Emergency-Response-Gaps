import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateRoute, parseRoutesResponse } from "./routing";

const config = { region: "us-east-1", apiKey: "k", mapStyle: "Monochrome", colorScheme: "Dark", routingEnabled: true };
const origin = { longitude: -123.1, latitude: 49.28 };
const destination = { longitude: -123.0, latitude: 49.23 };

const response = {
  Routes: [
    {
      Summary: { Distance: 10113, Duration: 872 },
      Legs: [{ Geometry: { LineString: [[-123.1, 49.28], [-123.05, 49.25], [-123.0, 49.23]] as [number, number][] } }],
    },
  ],
};

describe("Amazon Location routing", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("parses distance, duration and geometry", () => {
    expect(parseRoutesResponse(response)).toEqual({
      distanceMeters: 10113,
      durationSeconds: 872,
      coordinates: [[-123.1, 49.28], [-123.05, 49.25], [-123.0, 49.23]],
    });
  });

  it("falls back to leg travel steps when no route summary is present", () => {
    const legsOnly = {
      Routes: [
        {
          Legs: [
            {
              Geometry: { LineString: [[0, 0], [1, 1]] as [number, number][] },
              VehicleLegDetails: { TravelSteps: [{ Distance: 1000, Duration: 60 }, { Distance: 500, Duration: 30 }] },
            },
          ],
        },
      ],
    };
    expect(parseRoutesResponse(legsOnly)).toMatchObject({ distanceMeters: 1500, durationSeconds: 90 });
    expect(() => parseRoutesResponse({ Routes: [] })).toThrow("No drivable route");
  });

  it("posts a Car route request with simple geometry to the Routes v2 API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await calculateRoute(origin, destination, undefined, config);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://routes.geo.us-east-1.amazonaws.com/v2/routes?key=k");
    expect(JSON.parse(init.body)).toMatchObject({ Origin: [-123.1, 49.28], Destination: [-123, 49.23], TravelMode: "Car", LegGeometryFormat: "Simple" });
  });

  it("explains authorization and no-route failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 403 })));
    await expect(calculateRoute(origin, destination, undefined, config)).rejects.toThrow("geo-routes:CalculateRoutes");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 400 })));
    await expect(calculateRoute(origin, destination, undefined, config)).rejects.toThrow("No drivable route");
  });
});
