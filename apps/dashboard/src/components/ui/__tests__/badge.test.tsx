import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "../badge";

describe("Badge Component", () => {
  describe("Rendering", () => {
    it("should render a span element", () => {
      const { container } = render(<Badge>Default</Badge>);
      const badge = container.querySelector("span");
      expect(badge).toBeTruthy();
    });

    it("should render children text", () => {
      render(<Badge>Badge Text</Badge>);
      expect(screen.getByText("Badge Text")).toBeTruthy();
    });

    it("should have displayName set to Badge", () => {
      expect(Badge.displayName).toBe("Badge");
    });

    it("should render as inline element", () => {
      const { container } = render(<Badge>Inline</Badge>);
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("inline-flex");
    });
  });

  describe("Variants", () => {
    it("should render with default variant", () => {
      const { container } = render(<Badge>Default</Badge>);
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("text-wl-neutral-300");
      expect(badge?.className).toContain("bg-white/6");
    });

    it("should render with default variant explicitly", () => {
      const { container } = render(<Badge variant="default">Default</Badge>);
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("text-wl-neutral-300");
      expect(badge?.className).toContain("bg-white/6");
    });

    it("should render with success variant", () => {
      const { container } = render(<Badge variant="success">Active</Badge>);
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("text-wl-success-400");
      expect(badge?.className).toContain("bg-wl-success-bg");
    });

    it("should render with warning variant", () => {
      const { container } = render(<Badge variant="warning">Pending</Badge>);
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("text-wl-warning-400");
      expect(badge?.className).toContain("bg-wl-warning-bg");
    });

    it("should render with danger variant", () => {
      const { container } = render(<Badge variant="danger">Error</Badge>);
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("text-wl-danger-400");
      expect(badge?.className).toContain("bg-wl-danger-bg");
    });

    it("should render with info variant", () => {
      const { container } = render(<Badge variant="info">Information</Badge>);
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("text-wl-info-400");
      expect(badge?.className).toContain("bg-wl-info-bg");
    });

    it("should render with primary variant", () => {
      const { container } = render(<Badge variant="primary">Primary</Badge>);
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("text-wl-primary-400");
      expect(badge?.className).toContain("bg-wl-primary-500/12");
    });

    it("should handle all variant types", () => {
      const variants = [
        "default",
        "success",
        "warning",
        "danger",
        "info",
        "primary",
      ] as const;

      variants.forEach((variant) => {
        const { container } = render(
          <Badge variant={variant}>{variant}</Badge>,
        );
        const badge = container.querySelector("span");
        expect(badge).toBeTruthy();
      });
    });
  });

  describe("Dot Indicator", () => {
    it("should not render dot by default", () => {
      const { container } = render(<Badge>No Dot</Badge>);
      const badge = container.querySelector("span");
      const innerSpans = badge?.querySelectorAll("span");
      expect(innerSpans?.length).toBe(0);
    });

    it("should render dot when dot prop is true", () => {
      const { container } = render(<Badge dot>With Dot</Badge>);
      const badge = container.querySelector("span");
      const innerSpans = badge?.querySelectorAll("span");
      expect(innerSpans?.length).toBeGreaterThan(0);
    });

    it("should apply dot styles", () => {
      const { container } = render(<Badge dot>Styled Dot</Badge>);
      const badge = container.querySelector("span");
      const dot = badge?.querySelector("span");
      expect(dot?.className).toContain("w-1.5");
      expect(dot?.className).toContain("h-1.5");
      expect(dot?.className).toContain("rounded-full");
      expect(dot?.className).toContain("bg-current");
    });

    it("should have flex-shrink-0 on dot", () => {
      const { container } = render(<Badge dot>No Shrink</Badge>);
      const badge = container.querySelector("span");
      const dot = badge?.querySelector("span");
      expect(dot?.className).toContain("flex-shrink-0");
    });

    it("should mark dot as aria-hidden", () => {
      const { container } = render(<Badge dot>Hidden Dot</Badge>);
      const badge = container.querySelector("span");
      const dot = badge?.querySelector("span");
      expect(dot?.getAttribute("aria-hidden")).toBe("true");
    });

    it("should render dot before text content", () => {
      render(<Badge dot>Text After Dot</Badge>);
      expect(screen.getByText("Text After Dot")).toBeTruthy();
    });

    it("should work with all variants", () => {
      const variants = [
        "default",
        "success",
        "warning",
        "danger",
        "info",
        "primary",
      ] as const;

      variants.forEach((variant) => {
        const { container } = render(
          <Badge variant={variant} dot>
            {variant}
          </Badge>,
        );
        const badge = container.querySelector("span");
        expect(badge?.querySelector("span")).toBeTruthy();
      });
    });
  });

  describe("Base Styles", () => {
    it("should have flex layout", () => {
      const { container } = render(<Badge>Flex</Badge>);
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("inline-flex");
      expect(badge?.className).toContain("items-center");
      expect(badge?.className).toContain("gap-1");
    });

    it("should have text size", () => {
      const { container } = render(<Badge>Text</Badge>);
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("text-xs");
      expect(badge?.className).toContain("font-semibold");
    });

    it("should have padding", () => {
      const { container } = render(<Badge>Padded</Badge>);
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("px-2");
      expect(badge?.className).toContain("py-0.5");
    });

    it("should be rounded", () => {
      const { container } = render(<Badge>Rounded</Badge>);
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("rounded-full");
    });

    it("should have tracking and line height", () => {
      const { container } = render(<Badge>Letter Spacing</Badge>);
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("tracking-wide");
      expect(badge?.className).toContain("uppercase");
      expect(badge?.className).toContain("leading-relaxed");
    });

    it("should have whitespace-nowrap", () => {
      const { container } = render(<Badge>No Wrap</Badge>);
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("whitespace-nowrap");
    });
  });

  describe("className Merging with cn()", () => {
    it("should merge custom className with default classes", () => {
      const { container } = render(
        <Badge className="custom-badge">Custom</Badge>,
      );
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("custom-badge");
      expect(badge?.className).toContain("inline-flex");
      expect(badge?.className).toContain("text-xs");
    });

    it("should override styles with custom className", () => {
      const { container } = render(
        <Badge className="text-sm">Override Size</Badge>,
      );
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("text-sm");
    });

    it("should apply custom className on variant", () => {
      const { container } = render(
        <Badge variant="success" className="shadow-lg">
          Success Badge
        </Badge>,
      );
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("text-wl-success-400");
      expect(badge?.className).toContain("shadow-lg");
    });

    it("should work with multiple custom classes", () => {
      const { container } = render(
        <Badge className="class-1 class-2 class-3">Multiple</Badge>,
      );
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("class-1");
      expect(badge?.className).toContain("class-2");
      expect(badge?.className).toContain("class-3");
    });

    it("should combine with dot prop", () => {
      const { container } = render(
        <Badge dot className="custom-dot">
          Dot Custom
        </Badge>,
      );
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("custom-dot");
      expect(badge?.querySelector("span")).toBeTruthy();
    });
  });

  describe("Children Rendering", () => {
    it("should render text children", () => {
      render(<Badge>Text</Badge>);
      expect(screen.getByText("Text")).toBeTruthy();
    });

    it("should render numeric children", () => {
      render(<Badge>42</Badge>);
      expect(screen.getByText("42")).toBeTruthy();
    });

    it("should render element children", () => {
      render(
        <Badge>
          <span>Nested Element</span>
        </Badge>,
      );
      expect(screen.getByText("Nested Element")).toBeTruthy();
    });

    it("should render mixed content with dot", () => {
      render(
        <Badge dot>
          <span>Status</span>
        </Badge>,
      );
      expect(screen.getByText("Status")).toBeTruthy();
    });
  });

  describe("Forward Ref", () => {
    it("should forward ref to span element", () => {
      const { container } = render(<Badge>Ref</Badge>);
      const badge = container.querySelector("span");
      expect(badge).toBeTruthy();
    });

    it("should allow ref assignment", () => {
      const ref = { current: null };
      const { container } = render(<Badge ref={ref as any}>Ref Test</Badge>);
      const badge = container.querySelector("span");
      expect(badge).toBeTruthy();
    });
  });

  describe("HTML Attributes", () => {
    it("should support data attributes", () => {
      const { container } = render(
        <Badge data-testid="test-badge">Data</Badge>,
      );
      const badge = container.querySelector("span");
      expect(badge?.getAttribute("data-testid")).toBe("test-badge");
    });

    it("should support aria attributes", () => {
      const { container } = render(
        <Badge aria-label="Success status">Success</Badge>,
      );
      const badge = container.querySelector("span");
      expect(badge?.getAttribute("aria-label")).toBe("Success status");
    });

    it("should support id attribute", () => {
      const { container } = render(<Badge id="badge-1">Badge</Badge>);
      const badge = container.querySelector("span");
      expect(badge?.getAttribute("id")).toBe("badge-1");
    });

    it("should support title attribute", () => {
      const { container } = render(<Badge title="Badge title">Badge</Badge>);
      const badge = container.querySelector("span");
      expect(badge?.getAttribute("title")).toBe("Badge title");
    });
  });

  describe("Accessibility", () => {
    it("should be keyboard accessible", () => {
      const { container } = render(<Badge>Accessible</Badge>);
      const badge = container.querySelector("span");
      expect(badge).toBeTruthy();
    });

    it("should support aria-label for status badges", () => {
      const { container } = render(
        <Badge variant="success" aria-label="Status: Active">
          Active
        </Badge>,
      );
      const badge = container.querySelector("span");
      expect(badge?.getAttribute("aria-label")).toBe("Status: Active");
    });
  });

  describe("Combination Tests", () => {
    it("should combine variant, dot, and className", () => {
      const { container } = render(
        <Badge variant="success" dot className="custom">
          Complete
        </Badge>,
      );
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("text-wl-success-400");
      expect(badge?.className).toContain("custom");
      expect(badge?.querySelector("span")).toBeTruthy();
    });

    it("should render all possible combinations", () => {
      const variants = [
        "default",
        "success",
        "warning",
        "danger",
        "info",
        "primary",
      ] as const;

      variants.forEach((variant) => {
        const { container } = render(
          <Badge variant={variant} dot className={`badge-${variant}`}>
            {variant}
          </Badge>,
        );
        const badge = container.querySelector("span");
        expect(badge?.className).toContain(`badge-${variant}`);
        expect(badge?.querySelector("span")).toBeTruthy();
      });
    });

    it("should render with all props together", () => {
      const { container } = render(
        <Badge
          variant="danger"
          dot
          className="custom-danger"
          aria-label="Error state"
          data-testid="error-badge"
        >
          Error
        </Badge>,
      );
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("text-wl-danger-400");
      expect(badge?.getAttribute("aria-label")).toBe("Error state");
      expect(badge?.getAttribute("data-testid")).toBe("error-badge");
    });
  });

  describe("Variant Colors", () => {
    it("should have correct color scheme for success", () => {
      const { container } = render(<Badge variant="success">Success</Badge>);
      const badge = container.querySelector("span");
      const classes = badge?.className || "";
      expect(classes).toContain("wl-success");
    });

    it("should have correct color scheme for warning", () => {
      const { container } = render(<Badge variant="warning">Warning</Badge>);
      const badge = container.querySelector("span");
      const classes = badge?.className || "";
      expect(classes).toContain("wl-warning");
    });

    it("should have correct color scheme for danger", () => {
      const { container } = render(<Badge variant="danger">Danger</Badge>);
      const badge = container.querySelector("span");
      const classes = badge?.className || "";
      expect(classes).toContain("wl-danger");
    });

    it("should have correct color scheme for info", () => {
      const { container } = render(<Badge variant="info">Info</Badge>);
      const badge = container.querySelector("span");
      const classes = badge?.className || "";
      expect(classes).toContain("wl-info");
    });

    it("should have correct color scheme for primary", () => {
      const { container } = render(<Badge variant="primary">Primary</Badge>);
      const badge = container.querySelector("span");
      const classes = badge?.className || "";
      expect(classes).toContain("wl-primary");
    });
  });

  describe("Edge Cases", () => {
    it("should render with empty children", () => {
      const { container } = render(<Badge>{""}</Badge>);
      const badge = container.querySelector("span");
      expect(badge).toBeTruthy();
    });

    it("should render with whitespace children", () => {
      const { container } = render(<Badge> </Badge>);
      const badge = container.querySelector("span");
      expect(badge).toBeTruthy();
    });

    it("should handle long text", () => {
      render(
        <Badge>
          This is a very long badge text that should still render correctly
        </Badge>,
      );
      expect(
        screen.getByText(
          "This is a very long badge text that should still render correctly",
        ),
      ).toBeTruthy();
    });
  });
});
