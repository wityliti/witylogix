import { describe, it, expect } from "vitest";
import { buildMapStyle } from "../../../styles/wl-map-style";

describe("buildMapStyle", () => {
  it("returns a MapLibre style with the provided MapTiler key", () => {
    const style = buildMapStyle({ maptilerKey: "KEY123" });
    expect(style).toMatchObject({
      version: 8,
      sources: expect.objectContaining({
        basemap: expect.objectContaining({
          url: expect.stringContaining("key=KEY123"),
        }),
      }),
    });
  });

  it("declares empty sources for zones, heatmap, pins, hubs", () => {
    const style = buildMapStyle({ maptilerKey: "k" });
    expect(style.sources).toHaveProperty("zones");
    expect(style.sources).toHaveProperty("heatmap");
    expect(style.sources).toHaveProperty("pins");
    expect(style.sources).toHaveProperty("hubs");
  });

  it('uses the backdrop-dark map when basemap is "backdrop"', () => {
    const style = buildMapStyle({ maptilerKey: "k", basemap: "backdrop" });
    const basemap = style.sources.basemap as { url: string };
    expect(basemap.url).toContain("backdrop-dark");
    expect(basemap.url).toContain("tiles.json");
  });

  it("defaults to dataviz-dark map when basemap is omitted", () => {
    const style = buildMapStyle({ maptilerKey: "k" });
    const basemap = style.sources.basemap as { url: string };
    expect(basemap.url).toContain("dataviz-dark");
  });
});
