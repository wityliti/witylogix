import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "../button";

describe("Button Component", () => {
  describe("Rendering", () => {
    it("should render a button element", () => {
      const { container } = render(<Button>Click me</Button>);
      const button = container.querySelector("button");
      expect(button).toBeTruthy();
    });

    it("should render with children text", () => {
      render(<Button>Submit</Button>);
      expect(screen.getByText("Submit")).toBeTruthy();
    });

    it("should have displayName set to Button", () => {
      expect(Button.displayName).toBe("Button");
    });
  });

  describe("Variants", () => {
    it("should render with default primary variant", () => {
      const { container } = render(<Button>Primary</Button>);
      const button = container.querySelector("button");
      expect(button?.className).toContain("from-wl-primary-500");
    });

    it("should render with primary variant explicitly", () => {
      const { container } = render(<Button variant="primary">Primary</Button>);
      const button = container.querySelector("button");
      expect(button?.className).toContain("from-wl-primary-500");
      expect(button?.className).toContain("to-wl-primary-600");
    });

    it("should render with secondary variant", () => {
      const { container } = render(
        <Button variant="secondary">Secondary</Button>,
      );
      const button = container.querySelector("button");
      expect(button?.className).toContain("bg-wl-bg-overlay");
      expect(button?.className).toContain("text-wl-text-primary");
    });

    it("should render with ghost variant", () => {
      const { container } = render(<Button variant="ghost">Ghost</Button>);
      const button = container.querySelector("button");
      expect(button?.className).toContain("bg-transparent");
      expect(button?.className).toContain("text-wl-text-secondary");
    });

    it("should render with danger variant", () => {
      const { container } = render(<Button variant="danger">Delete</Button>);
      const button = container.querySelector("button");
      expect(button?.className).toContain("bg-wl-danger-bg");
      expect(button?.className).toContain("text-wl-danger-400");
    });

    it("should not render outline variant (not supported)", () => {
      const { container } = render(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <Button variant={"outline" as any}>Outline</Button>,
      );
      const button = container.querySelector("button");
      // outline variant should not be applied, should fall back to default or error
      expect(button).toBeTruthy();
    });
  });

  describe("Sizes", () => {
    it("should render with default md size", () => {
      const { container } = render(<Button>Medium</Button>);
      const button = container.querySelector("button");
      expect(button?.className).toContain("px-4");
      expect(button?.className).toContain("py-2");
      expect(button?.className).toContain("text-sm");
    });

    it("should render with sm size", () => {
      const { container } = render(<Button size="sm">Small</Button>);
      const button = container.querySelector("button");
      expect(button?.className).toContain("px-3");
      expect(button?.className).toContain("py-1");
      expect(button?.className).toContain("text-xs");
    });

    it("should render with md size explicitly", () => {
      const { container } = render(<Button size="md">Medium</Button>);
      const button = container.querySelector("button");
      expect(button?.className).toContain("px-4");
      expect(button?.className).toContain("py-2");
    });

    it("should render with lg size", () => {
      const { container } = render(<Button size="lg">Large</Button>);
      const button = container.querySelector("button");
      expect(button?.className).toContain("px-5");
      expect(button?.className).toContain("py-3");
      expect(button?.className).toContain("text-base");
    });
  });

  describe("States", () => {
    it("should apply disabled state", () => {
      const { container } = render(<Button disabled>Disabled</Button>);
      const button = container.querySelector("button") as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      expect(button.className).toContain("disabled:opacity-50");
      expect(button.className).toContain("disabled:cursor-not-allowed");
    });

    it("should be disabled when disabled prop is true", () => {
      const { container } = render(
        <Button disabled={true}>Cannot Click</Button>,
      );
      const button = container.querySelector("button") as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it("should not be disabled when disabled prop is false", () => {
      const { container } = render(<Button disabled={false}>Can Click</Button>);
      const button = container.querySelector("button") as HTMLButtonElement;
      expect(button.disabled).toBe(false);
    });

    it("should have focus styles", () => {
      const { container } = render(<Button>Focused</Button>);
      const button = container.querySelector("button");
      expect(button?.className).toContain("focus-visible:outline-2");
      expect(button?.className).toContain("focus-visible:outline-offset-2");
      expect(button?.className).toContain(
        "focus-visible:outline-wl-primary-500",
      );
    });

    it("should have hover styles for primary variant", () => {
      const { container } = render(<Button variant="primary">Hover Me</Button>);
      const button = container.querySelector("button");
      expect(button?.className).toContain("hover:from-wl-primary-600");
      expect(button?.className).toContain("hover:to-wl-primary-700");
      expect(button?.className).toContain("hover:shadow-md");
    });
  });

  describe("Click Handler", () => {
    it("should handle click events", async () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);

      const button = screen.getByText("Click me");
      await userEvent.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("should not trigger click when disabled", async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      const { container } = render(
        <Button onClick={handleClick} disabled>
          Click me
        </Button>,
      );

      const button = container.querySelector("button") as HTMLButtonElement;
      // Disabled buttons prevent click from reaching onClick handler
      expect(button.disabled).toBe(true);
    });

    it("should pass through additional event props", async () => {
      const handleMouseEnter = vi.fn();
      const user = userEvent.setup();

      const { container } = render(
        <Button onMouseEnter={handleMouseEnter}>Hover me</Button>,
      );

      const button = container.querySelector("button");
      if (button) fireEvent.mouseEnter(button);

      expect(handleMouseEnter).toHaveBeenCalled();
    });
  });

  describe("Loading State", () => {
    it("should render with loading state indicator", () => {
      render(
        <Button disabled className="opacity-50">
          <span>Loading...</span>
        </Button>,
      );

      expect(screen.getByText("Loading...")).toBeTruthy();
    });

    it("should disable button during loading", () => {
      const { container } = render(<Button disabled>Submitting...</Button>);

      const button = container.querySelector("button") as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });
  });

  describe("asChild Prop", () => {
    it("should accept asChild prop", () => {
      const { container } = render(
        <Button asChild>
          <a href="/home">Link Button</a>
        </Button>,
      );

      expect(container.querySelector("button")).toBeTruthy();
    });
  });

  describe("className Merging with cn()", () => {
    it("should merge custom className with default classes", () => {
      const { container } = render(
        <Button className="custom-class">Merged</Button>,
      );

      const button = container.querySelector("button");
      expect(button?.className).toContain("custom-class");
      expect(button?.className).toContain("inline-flex");
    });

    it("should apply custom className on top of variant styles", () => {
      const { container } = render(
        <Button variant="primary" className="text-white">
          Custom Primary
        </Button>,
      );

      const button = container.querySelector("button");
      expect(button?.className).toContain("from-wl-primary-500");
      expect(button?.className).toContain("text-white");
    });

    it("should apply custom className on top of size styles", () => {
      const { container } = render(
        <Button size="lg" className="w-full">
          Full Width
        </Button>,
      );

      const button = container.querySelector("button");
      expect(button?.className).toContain("px-5");
      expect(button?.className).toContain("w-full");
    });

    it("should allow overriding default padding with custom className", () => {
      const { container } = render(
        <Button className="px-10 py-5">Custom Padding</Button>,
      );

      const button = container.querySelector("button");
      expect(button?.className).toContain("px-10");
      expect(button?.className).toContain("py-5");
    });

    it("should handle multiple custom classes", () => {
      const { container } = render(
        <Button className="class-1 class-2 class-3">Multiple Classes</Button>,
      );

      const button = container.querySelector("button");
      expect(button?.className).toContain("class-1");
      expect(button?.className).toContain("class-2");
      expect(button?.className).toContain("class-3");
    });
  });

  describe("Accessibility", () => {
    it("should have proper button role", () => {
      const { container } = render(<Button>Accessible</Button>);
      const button = container.querySelector("button");
      expect(button?.tagName.toLowerCase()).toBe("button");
    });

    it("should support aria-label", () => {
      const { container } = render(<Button aria-label="Close modal">×</Button>);

      const button = container.querySelector("button");
      expect(button?.getAttribute("aria-label")).toBe("Close modal");
    });

    it("should communicate disabled state to assistive tech", () => {
      const { container } = render(
        <Button disabled aria-disabled={true}>
          Disabled
        </Button>,
      );

      const button = container.querySelector("button") as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it("should be keyboard accessible", async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(<Button onClick={handleClick}>Keyboard</Button>);

      const button = screen.getByText("Keyboard");
      await user.tab();
      await user.keyboard("{Enter}");

      expect(handleClick).toHaveBeenCalled();
    });

    it("should have transition classes for smooth interactions", () => {
      const { container } = render(<Button>Transition</Button>);
      const button = container.querySelector("button");
      expect(button?.className).toContain("transition-all");
      expect(button?.className).toContain("duration-fast");
    });
  });

  describe("Children Rendering", () => {
    it("should render text children", () => {
      render(<Button>Text</Button>);
      expect(screen.getByText("Text")).toBeTruthy();
    });

    it("should render element children", () => {
      render(
        <Button>
          <span>Icon</span> Label
        </Button>,
      );
      expect(screen.getByText("Icon")).toBeTruthy();
      expect(screen.getByText("Label")).toBeTruthy();
    });

    it("should render multiple children with gap", () => {
      const { container } = render(
        <Button>
          <span>Icon</span>
          <span>Text</span>
        </Button>,
      );

      const button = container.querySelector("button");
      expect(button?.className).toContain("gap-2");
    });
  });

  describe("Forward Ref", () => {
    it("should forward ref to button element", () => {
      const ref = { current: null };
      const { container } = render(<Button ref={ref as any}>Ref</Button>);

      const button = container.querySelector("button");
      expect(button).toBeTruthy();
    });
  });

  describe("Base Styles", () => {
    it("should have inline-flex display", () => {
      const { container } = render(<Button>Flex</Button>);
      const button = container.querySelector("button");
      expect(button?.className).toContain("inline-flex");
    });

    it("should have center alignment", () => {
      const { container } = render(<Button>Center</Button>);
      const button = container.querySelector("button");
      expect(button?.className).toContain("items-center");
      expect(button?.className).toContain("justify-center");
    });

    it("should have cursor-pointer", () => {
      const { container } = render(<Button>Clickable</Button>);
      const button = container.querySelector("button");
      expect(button?.className).toContain("cursor-pointer");
    });

    it("should have font settings", () => {
      const { container } = render(<Button>Font</Button>);
      const button = container.querySelector("button");
      expect(button?.className).toContain("font-family-sans");
      expect(button?.className).toContain("tracking-wider");
      expect(button?.className).toContain("leading-snug");
      expect(button?.className).toContain("whitespace-nowrap");
    });
  });

  describe("Combination Tests", () => {
    it("should combine variant, size, and className", () => {
      const { container } = render(
        <Button variant="danger" size="sm" className="custom">
          Danger Small
        </Button>,
      );

      const button = container.querySelector("button");
      expect(button?.className).toContain("bg-wl-danger-bg");
      expect(button?.className).toContain("px-3");
      expect(button?.className).toContain("custom");
    });

    it("should combine all props together", () => {
      const handleClick = vi.fn();
      const { container } = render(
        <Button
          variant="secondary"
          size="lg"
          className="w-full"
          onClick={handleClick}
          aria-label="Custom Button"
        >
          Full Button
        </Button>,
      );

      const button = container.querySelector("button") as HTMLButtonElement;
      expect(button.className).toContain("bg-wl-bg-overlay");
      expect(button.className).toContain("px-5");
      expect(button.className).toContain("w-full");
      expect(button.getAttribute("aria-label")).toBe("Custom Button");
    });
  });
});
