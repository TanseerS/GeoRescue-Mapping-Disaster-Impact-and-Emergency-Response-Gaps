import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPopulation } from "./population";

const complete = {
  status: "complete",
  dataset: "WorldPop Global Population (unconstrained)",
  year: 2020,
  resolution: "~100 m",
  license: "CC BY 4.0",
  sourceUrl: "https://hub.worldpop.org",
  results: [{ radiusKm: 10, population: 1200 }],
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("fetchPopulation", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("polls WorldPop tasks until the estimate is complete, then caches it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ status: "pending", tasks: ["t1"], retryAfterMs: 3000 }, 202))
      .mockResolvedValueOnce(json({ status: "pending", tasks: ["t1"] }, 202))
      .mockResolvedValueOnce(json(complete));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchPopulation("https://api.example.com", 35.6812, 139.7671, [10], undefined, 1);
    expect(result.results[0].population).toBe(1200);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.com/population?lat=35.6812&lon=139.7671&radii=10");
    expect(fetchMock.mock.calls[2][0]).toContain("/population/tasks?lat=35.6812&lon=139.7671&radii=10&ids=t1");
    await fetchPopulation("https://api.example.com", 35.6812, 139.7671, [10], undefined, 1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retries a failed submission once, then surfaces the API error", async () => {
    const fail = () => json({ error: "The WorldPop population service is unavailable. Retry shortly." }, 502);
    const flaky = vi.fn().mockResolvedValueOnce(fail()).mockResolvedValueOnce(json(complete));
    vi.stubGlobal("fetch", flaky);
    expect((await fetchPopulation("https://api.example.com", 3, 4, [10], undefined, 1)).results[0].population).toBe(1200);
    expect(flaky).toHaveBeenCalledTimes(2);

    const down = vi.fn().mockImplementation(async () => fail());
    vi.stubGlobal("fetch", down);
    await expect(fetchPopulation("https://api.example.com", 1, 2, [10], undefined, 1)).rejects.toThrow("WorldPop population service is unavailable");
    expect(down).toHaveBeenCalledTimes(2);
  });
});
