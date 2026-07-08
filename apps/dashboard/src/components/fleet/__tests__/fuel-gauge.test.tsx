import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FuelGauge } from "../fuel-gauge";

describe("FuelGauge Component", () => {
  describe("Rendering", () => {
    it("should render SVG element", () => {
      const { container } = render(<FuelGauge fuelLevel={50} />);
      const svg = container.querySelector("svg");
      expect(svg).toBeTruthy();
    });

    it("should render fuel level text", () => {
      const { container } = render(<FuelGauge fuelLevel={75} />);
      expect(container.textContent).toContain("75%");
    });

    it("should render tank capacity label", () => {
      const { container } = render(
        <FuelGauge fuelLevel={50} tankCapacity={60} />,
      );
      expect(container.textContent).toContain("60L");
    });

    it("should display legend with color thresholds", () => {
      const { container } = render(<FuelGauge fuelLevel={50} />);
      expect(container.textContent).toContain("> 50%");
      expect(container.textContent).toContain("25-50%");
      expect(container.textContent).toContain("< 25%");
    });
  });

  describe("Size Variants", () => {
    it("should render with small size", () => {
      const { container } = render(<FuelGauge fuelLevel={50} size="sm" />);
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("width")).toBeDefined();
    });

    it("should render with medium size", () => {
      const { container } = render(<FuelGauge fuelLevel={50} size="md" />);
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("width")).toBeDefined();
    });

    it("should render with large size", () => {
      const { container } = render(<FuelGauge fuelLevel={50} size="lg" />);
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("width")).toBeDefined();
    });
  });

  describe("Fuel Level Ranges", () => {
    it("should handle empty tank (0%)", () => {
      const { container } = render(<FuelGauge fuelLevel={0} />);
      expect(container.textContent).toContain("0%");
    });

    it("should handle full tank (100%)", () => {
      const { container } = render(<FuelGauge fuelLevel={100} />);
      expect(container.textContent).toContain("100%");
    });

    it("should handle low fuel level (20%)", () => {
      const { container } = render(<FuelGauge fuelLevel={20} />);
      expect(container.textContent).toContain("20%");
    });

    it("should handle mid fuel level (50%)", () => {
      const { container } = render(<FuelGauge fuelLevel={50} />);
      expect(container.textContent).toContain("50%");
    });

    it("should handle high fuel level (80%)", () => {
      const { container } = render(<FuelGauge fuelLevel={80} />);
      expect(container.textContent).toContain("80%");
    });
  });

  describe("Custom Tank Capacity", () => {
    it("should render custom tank capacity", () => {
      const { container } = render(
        <FuelGauge fuelLevel={50} tankCapacity={100} />,
      );
      expect(container.textContent).toContain("100L");
    });

    it("should render default tank capacity when not provided", () => {
      const { container } = render(<FuelGauge fuelLevel={50} />);
      expect(container.textContent).toContain("60L");
    });

    it("should handle large tank capacity", () => {
      const { container } = render(
        <FuelGauge fuelLevel={50} tankCapacity={500} />,
      );
      expect(container.textContent).toContain("500L");
    });
  });

  describe("Animation", () => {
    it("should support animation prop", () => {
      const { container } = render(
        <FuelGauge fuelLevel={50} animated={true} />,
      );
      const svg = container.querySelector("svg");
      expect(svg).toBeTruthy();
    });

    it("should support non-animated mode", () => {
      const { container } = render(
        <FuelGauge fuelLevel={50} animated={false} />,
      );
      const svg = container.querySelector("svg");
      expect(svg).toBeTruthy();
    });
  });

  describe("SVG Elements", () => {
    it("should contain gauge track path", () => {
      const { container } = render(<FuelGauge fuelLevel={50} />);
      const paths = container.querySelectorAll("path");
      expect(paths.length).toBeGreaterThan(0);
    });

    it("should contain needle line element", () => {
      const { container } = render(<FuelGauge fuelLevel={50} />);
      const lines = container.querySelectorAll("line");
      expect(lines.length).toBeGreaterThan(0);
    });

    it("should contain center circle", () => {
      const { container } = render(<FuelGauge fuelLevel={50} />);
      const circles = container.querySelectorAll("circle");
      expect(circles.length).toBeGreaterThan(0);
    });

    it("should contain text labels", () => {
      const { container } = render(<FuelGauge fuelLevel={50} />);
      const texts = container.querySelectorAll("text");
      expect(texts.length).toBeGreaterThan(0);
    });
  });

  describe("Color Gradients", () => {
    it("should define color gradients in SVG defs", () => {
      const { container } = render(<FuelGauge fuelLevel={50} />);
      const defs = container.querySelector("defs");
      expect(defs?.querySelector("#redGradient")).toBeTruthy();
      expect(defs?.querySelector("#yellowGradient")).toBeTruthy();
      expect(defs?.querySelector("#greenGradient")).toBeTruthy();
    });
  });

  describe("CSS Classes", () => {
    it("should accept custom className", () => {
      const { container } = render(
        <FuelGauge fuelLevel={50} className="custom-gauge" />,
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper?.className).toContain("custom-gauge");
    });

    it("should have flex layout", () => {
      const { container } = render(<FuelGauge fuelLevel={50} />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper?.className).toContain("flex");
      expect(wrapper?.className).toContain("flex-col");
    });
  });

  describe("Responsive Behavior", () => {
    it("should render responsive SVG with viewBox", () => {
      const { container } = render(<FuelGauge fuelLevel={50} size="md" />);
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("viewBox")).toBeTruthy();
    });
  });

  describe("Min/Max Labels", () => {
    it("should display E (Empty) label", () => {
      const { container } = render(<FuelGauge fuelLevel={50} />);
      expect(container.textContent).toContain("E");
    });

    it("should display F (Full) label", () => {
      const { container } = render(<FuelGauge fuelLevel={50} />);
      expect(container.textContent).toContain("F");
    });
  });

  describe("Edge Cases", () => {
    it("should handle decimal fuel levels", () => {
      const { container } = render(<FuelGauge fuelLevel={50.5} />);
      expect(container.textContent).toContain("50%");
    });

    it("should handle values above 100 gracefully", () => {
      const { container } = render(<FuelGauge fuelLevel={120} />);
      expect(container.textContent).toContain("120%");
    });

    it("should handle negative values", () => {
      const { container } = render(<FuelGauge fuelLevel={-10} />);
      expect(container.textContent).toContain("-10%");
    });
  });
});
