import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { ZoneInspector } from "../zone-inspector";

const zone = {
  id: "z1",
  name: "South Hub",
  baseRate: 40,
  perKmRate: 8,
  minOrder: 0,
  freeAbove: null,
  isActive: true,
  priority: 0,
};
const overlay = {
  id: "z1",
  openOrders: 12,
  drivers: 4,
  slaPct: 0.92,
  health: "good" as const,
};

describe("<ZoneInspector>", () => {
  it("monitor mode shows read-only zone summary", () => {
    render(
      <ZoneInspector
        zone={zone}
        overlay={overlay}
        mode="monitor"
        onSave={() => {}}
        onDelete={() => {}}
        onEditGeometry={() => {}}
      />,
    );
    expect(screen.getByText("South Hub")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit geometry/i })).toBeNull();
  });

  it("configure mode reveals editable fields and Edit geometry", () => {
    const onSave = vi.fn();
    render(
      <ZoneInspector
        zone={zone}
        overlay={overlay}
        mode="configure"
        onSave={onSave}
        onDelete={() => {}}
        onEditGeometry={() => {}}
      />,
    );
    const rate = screen.getByLabelText(/base rate/i) as HTMLInputElement;
    fireEvent.change(rate, { target: { value: "45" } });
    fireEvent.blur(rate);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ baseRate: 45 }),
    );
    expect(
      screen.getByRole("button", { name: /edit geometry/i }),
    ).toBeInTheDocument();
  });
});
