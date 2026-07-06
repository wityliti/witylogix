import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WLMapContext } from "../wl-map-context";
import { ZoneLayer } from "../zone-layer";

describe("<ZoneLayer>", () => {
  it("adds a GeoJSON source and layer on mount", () => {
    const addSource = vi.fn();
    const addLayer = vi.fn();
    const getSource = vi.fn();
    const map = {
      addSource,
      addLayer,
      getSource,
      getLayer: vi.fn(() => true),
      removeLayer: vi.fn(),
      removeSource: vi.fn(),
      isStyleLoaded: () => true,
      on: vi.fn(),
      off: vi.fn(),
      setPaintProperty: vi.fn(),
    };
    render(
      <WLMapContext.Provider value={map as unknown as never}>
        <ZoneLayer
          zones={{ type: "FeatureCollection", features: [] }}
          selectedId={null}
          onSelect={() => {}}
        />
      </WLMapContext.Provider>,
    );
    expect(addSource).toHaveBeenCalledWith(
      "zones",
      expect.objectContaining({ type: "geojson" }),
    );
    expect(addLayer).toHaveBeenCalled();
  });
});
