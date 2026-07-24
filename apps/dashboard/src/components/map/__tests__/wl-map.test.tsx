/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WLMap } from "../wl-map";

vi.mock("maplibre-gl", () => ({
  default: {
    Map: vi.fn(() => ({
      on: vi.fn(),
      remove: vi.fn(),
      addControl: vi.fn(),
      getCanvas: () => ({ style: {} }),
      getCenter: () => ({ lng: 0, lat: 0 }),
      getZoom: () => 0,
    })),
  },
}));

describe("<WLMap>", () => {
  it('renders a container element with data-testid="wl-map"', () => {
    render(<WLMap maptilerKey="k" center={[77.12, 28.65]} zoom={12} />);
    expect(screen.getByTestId("wl-map")).toBeInTheDocument();
  });
});
