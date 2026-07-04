import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WLMapContext } from "../wl-map-context";
import { HeatmapLayer } from "../heatmap-layer";
import { PinLayer } from "../pin-layer";
import { HubLayer } from "../hub-layer";

const mockMap = () => ({
  addSource: vi.fn(),
  addLayer: vi.fn(),
  getSource: vi.fn(),
  getLayer: vi.fn(),
  removeLayer: vi.fn(),
  removeSource: vi.fn(),
  setPaintProperty: vi.fn(),
  isStyleLoaded: () => true,
  on: vi.fn(),
  off: vi.fn(),
});

describe("map overlay layers", () => {
  it.each([
    ["heatmap", <HeatmapLayer points={[{ lng: 77, lat: 28, count: 3 }]} />],
    [
      "pins",
      <PinLayer pins={[{ id: "o1", lng: 77, lat: 28, status: "open" }]} />,
    ],
    [
      "hubs",
      <HubLayer
        hubs={[{ id: "h1", name: "DC", lng: 77, lat: 28, type: "warehouse" }]}
      />,
    ],
  ])("mounts %s source", (_name, node) => {
    const m = mockMap();
    render(
      <WLMapContext.Provider value={m as never}>{node}</WLMapContext.Provider>,
    );
    expect(m.addSource).toHaveBeenCalled();
    expect(m.addLayer).toHaveBeenCalled();
  });
});
