import { describe, expect, it, vi } from "vitest";
import { amazonLocationStyleUrl, amazonLocationTransform, awsMapSettings } from "./mapStyle";

const base = { region: "eu-west-1", apiKey: "v1.public.abc", mapStyle: "Standard", colorScheme: "Light" };

describe("Amazon Location map style", () => {
  it("builds a Maps API v2 style descriptor URL", () => {
    expect(amazonLocationStyleUrl(base)).toBe(
      "https://maps.geo.eu-west-1.amazonaws.com/v2/styles/Standard/descriptor?key=v1.public.abc&color-scheme=Light",
    );
    expect(amazonLocationStyleUrl({ ...base, mapStyle: "Satellite" })).not.toContain("color-scheme");
  });

  it("falls back to safe defaults for invalid settings", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(awsMapSettings({ ...base, mapStyle: "Fancy", colorScheme: "Blue", region: "not a region" })).toMatchObject({
      style: "Monochrome",
      colorScheme: "Dark",
      region: "us-east-1",
    });
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  it("adds the key only to Amazon Location tile requests that lack it", () => {
    const transform = amazonLocationTransform("k1");
    expect(transform("https://maps.geo.us-east-1.amazonaws.com/v2/tiles/vector.basemap/1/2/3").url).toBe(
      "https://maps.geo.us-east-1.amazonaws.com/v2/tiles/vector.basemap/1/2/3?key=k1",
    );
    const keyed = "https://maps.geo.us-east-1.amazonaws.com/v2/tiles/vector.basemap/1/2/3?key=other";
    expect(transform(keyed).url).toBe(keyed);
    const glyphs = "https://maps.geo.us-east-1.amazonaws.com/v2/glyphs/Noto/0-255.pbf";
    expect(transform(glyphs).url).toBe(glyphs);
    expect(transform("https://basemaps.cartocdn.com/x.pbf").url).toBe("https://basemaps.cartocdn.com/x.pbf");
  });
});
