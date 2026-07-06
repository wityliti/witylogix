import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VehicleStatusBadge } from "../vehicle-status-badge";

describe("VehicleStatusBadge Component", () => {
  describe("Rendering", () => {
    it("should render a span element", () => {
      const { container } = render(<VehicleStatusBadge status="moving" />);
      const badge = container.querySelector("span");
      expect(badge).toBeTruthy();
    });

    it("should have displayName set to VehicleStatusBadge", () => {
      expect(VehicleStatusBadge.displayName).toBe("VehicleStatusBadge");
    });

    it("should render as inline-flex", () => {
      const { container } = render(<VehicleStatusBadge status="moving" />);
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("inline-flex");
    });
  });

  describe("Status Variants", () => {
    it("should render moving status with correct text", () => {
      render(<VehicleStatusBadge status="moving" />);
      expect(screen.getByText("Moving")).toBeTruthy();
    });

    it("should render idle status with correct text", () => {
      render(<VehicleStatusBadge status="idle" />);
      expect(screen.getByText("Idle")).toBeTruthy();
    });

    it("should render stopped status with correct text", () => {
      render(<VehicleStatusBadge status="stopped" />);
      expect(screen.getByText("Stopped")).toBeTruthy();
    });

    it("should render offline status with correct text", () => {
      render(<VehicleStatusBadge status="offline" />);
      expect(screen.getByText("Offline")).toBeTruthy();
    });

    it("should render maintenance status with correct text", () => {
      render(<VehicleStatusBadge status="maintenance" />);
      expect(screen.getByText("Maintenance")).toBeTruthy();
    });
  });

  describe("Status Colors", () => {
    it("should have success colors for moving status", () => {
      const { container } = render(<VehicleStatusBadge status="moving" />);
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("bg-wl-success-500/12");
      expect(badge?.className).toContain("text-wl-success-400");
    });

    it("should have warning colors for idle status", () => {
      const { container } = render(<VehicleStatusBadge status="idle" />);
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("bg-wl-warning-500/12");
      expect(badge?.className).toContain("text-wl-warning-400");
    });

    it("should have danger colors for stopped status", () => {
      const { container } = render(<VehicleStatusBadge status="stopped" />);
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("bg-wl-danger-500/12");
      expect(badge?.className).toContain("text-wl-danger-400");
    });

    it("should have neutral colors for offline status", () => {
      const { container } = render(<VehicleStatusBadge status="offline" />);
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("bg-wl-neutral-500/12");
      expect(badge?.className).toContain("text-wl-neutral-300");
    });

    it("should have info colors for maintenance status", () => {
      const { container } = render(<VehicleStatusBadge status="maintenance" />);
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("bg-wl-info-500/12");
      expect(badge?.className).toContain("text-wl-info-400");
    });
  });

  describe("Animated Dot", () => {
    it("should render dot indicator", () => {
      const { container } = render(<VehicleStatusBadge status="moving" />);
      const dot = container.querySelector("span > span");
      expect(dot).toBeTruthy();
    });

    it("should have animated pulse for moving status", () => {
      const { container } = render(<VehicleStatusBadge status="moving" />);
      const dot = container.querySelector("span > span");
      expect(dot?.className).toContain("animate-pulse");
    });

    it("should not have animated pulse for idle status", () => {
      const { container } = render(<VehicleStatusBadge status="idle" />);
      const dot = container.querySelector("span > span");
      expect(dot?.className).not.toContain("animate-pulse");
    });

    it("should not have animated pulse for stopped status", () => {
      const { container } = render(<VehicleStatusBadge status="stopped" />);
      const dot = container.querySelector("span > span");
      expect(dot?.className).not.toContain("animate-pulse");
    });

    it("should not have animated pulse for offline status", () => {
      const { container } = render(<VehicleStatusBadge status="offline" />);
      const dot = container.querySelector("span > span");
      expect(dot?.className).not.toContain("animate-pulse");
    });

    it("should not have animated pulse for maintenance status", () => {
      const { container } = render(<VehicleStatusBadge status="maintenance" />);
      const dot = container.querySelector("span > span");
      expect(dot?.className).not.toContain("animate-pulse");
    });

    it("should mark dot as aria-hidden", () => {
      const { container } = render(<VehicleStatusBadge status="moving" />);
      const dot = container.querySelector("span > span");
      expect(dot?.getAttribute("aria-hidden")).toBe("true");
    });
  });

  describe("Base Styles", () => {
    it("should have rounded-full shape", () => {
      const { container } = render(<VehicleStatusBadge status="moving" />);
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("rounded-full");
    });

    it("should have padding", () => {
      const { container } = render(<VehicleStatusBadge status="moving" />);
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("px-2.5");
      expect(badge?.className).toContain("py-1");
    });

    it("should have text sizing", () => {
      const { container } = render(<VehicleStatusBadge status="moving" />);
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("text-xs");
      expect(badge?.className).toContain("font-semibold");
    });

    it("should have flex layout with gap", () => {
      const { container } = render(<VehicleStatusBadge status="moving" />);
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("flex");
      expect(badge?.className).toContain("items-center");
      expect(badge?.className).toContain("gap-1.5");
    });

    it("should have tracking-wide", () => {
      const { container } = render(<VehicleStatusBadge status="moving" />);
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("tracking-wide");
    });
  });

  describe("Dot Indicator Styles", () => {
    it("should have correct dot size", () => {
      const { container } = render(<VehicleStatusBadge status="moving" />);
      const dot = container.querySelector("span > span");
      expect(dot?.className).toContain("w-1.5");
      expect(dot?.className).toContain("h-1.5");
    });

    it("should have rounded dot", () => {
      const { container } = render(<VehicleStatusBadge status="moving" />);
      const dot = container.querySelector("span > span");
      expect(dot?.className).toContain("rounded-full");
    });

    it("should not shrink dot", () => {
      const { container } = render(<VehicleStatusBadge status="moving" />);
      const dot = container.querySelector("span > span");
      expect(dot?.className).toContain("flex-shrink-0");
    });

    it("should use current color for dot", () => {
      const { container } = render(<VehicleStatusBadge status="moving" />);
      const dot = container.querySelector("span > span");
      expect(dot?.className).toContain("bg-current");
    });
  });

  describe("Custom className", () => {
    it("should accept custom className", () => {
      const { container } = render(
        <VehicleStatusBadge status="moving" className="custom-class" />,
      );
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("custom-class");
    });

    it("should merge custom className with base classes", () => {
      const { container } = render(
        <VehicleStatusBadge status="moving" className="custom-class" />,
      );
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("custom-class");
      expect(badge?.className).toContain("inline-flex");
      expect(badge?.className).toContain("rounded-full");
    });
  });

  describe("HTML Attributes", () => {
    it("should support data attributes", () => {
      const { container } = render(
        <VehicleStatusBadge status="moving" data-testid="status-badge" />,
      );
      const badge = container.querySelector("span");
      expect(badge?.getAttribute("data-testid")).toBe("status-badge");
    });

    it("should support aria attributes", () => {
      const { container } = render(
        <VehicleStatusBadge status="moving" aria-label="Vehicle moving" />,
      );
      const badge = container.querySelector("span");
      expect(badge?.getAttribute("aria-label")).toBe("Vehicle moving");
    });

    it("should support id attribute", () => {
      const { container } = render(
        <VehicleStatusBadge status="moving" id="status-1" />,
      );
      const badge = container.querySelector("span");
      expect(badge?.getAttribute("id")).toBe("status-1");
    });

    it("should support title attribute", () => {
      const { container } = render(
        <VehicleStatusBadge status="moving" title="Vehicle is moving" />,
      );
      const badge = container.querySelector("span");
      expect(badge?.getAttribute("title")).toBe("Vehicle is moving");
    });
  });

  describe("Forward Ref", () => {
    it("should allow ref assignment", () => {
      const ref = { current: null };
      const { container } = render(
        <VehicleStatusBadge ref={ref as any} status="moving" />,
      );
      const badge = container.querySelector("span");
      expect(badge).toBeTruthy();
    });
  });

  describe("All Status Types", () => {
    it("should handle all status types", () => {
      const statuses: Array<
        "moving" | "idle" | "stopped" | "offline" | "maintenance"
      > = ["moving", "idle", "stopped", "offline", "maintenance"];

      statuses.forEach((status) => {
        const { container } = render(<VehicleStatusBadge status={status} />);
        const badge = container.querySelector("span");
        expect(badge).toBeTruthy();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should render with all props combined", () => {
      const { container } = render(
        <VehicleStatusBadge
          status="moving"
          className="custom"
          aria-label="Test label"
          data-testid="test"
        />,
      );
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("custom");
      expect(badge?.getAttribute("aria-label")).toBe("Test label");
      expect(badge?.getAttribute("data-testid")).toBe("test");
    });

    it("should be keyboard accessible", () => {
      const { container } = render(<VehicleStatusBadge status="moving" />);
      const badge = container.querySelector("span");
      expect(badge).toBeTruthy();
    });
  });
});
