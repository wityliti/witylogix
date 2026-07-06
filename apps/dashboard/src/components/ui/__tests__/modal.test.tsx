import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "../modal";

describe("Modal Component", () => {
  describe("Rendering", () => {
    it("should not render when isOpen is false", () => {
      const { container } = render(
        <Modal isOpen={false} onClose={vi.fn()}>
          Content
        </Modal>,
      );
      expect(container.querySelector('[role="dialog"]')).toBeFalsy();
    });

    it("should render when isOpen is true", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Content
        </Modal>,
      );
      expect(container.textContent).toContain("Content");
    });

    it("should render children content", () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Modal Content Here
        </Modal>,
      );
      expect(screen.getByText("Modal Content Here")).toBeTruthy();
    });

    it("should render with title when provided", () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Confirm Action">
          Are you sure?
        </Modal>,
      );
      expect(screen.getByText("Confirm Action")).toBeTruthy();
    });

    it("should not render title when not provided", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Content
        </Modal>,
      );
      const title = container.querySelector("h2");
      expect(title).toBeFalsy();
    });

    it("should have fixed positioning", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Content
        </Modal>,
      );
      const backdrop = container.firstChild as HTMLElement;
      expect(backdrop?.className).toContain("fixed");
      expect(backdrop?.className).toContain("inset-0");
      expect(backdrop?.className).toContain("z-50");
    });
  });

  describe("Size Variants", () => {
    it("should render with default md size", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Content
        </Modal>,
      );
      const modalContent = container.querySelector('[class*="max-w-md"]');
      expect(modalContent).toBeTruthy();
    });

    it("should render with sm size", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()} size="sm">
          Content
        </Modal>,
      );
      const modalContent = container.querySelector('[class*="max-w-sm"]');
      expect(modalContent).toBeTruthy();
    });

    it("should render with lg size", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()} size="lg">
          Content
        </Modal>,
      );
      const modalContent = container.querySelector('[class*="max-w-lg"]');
      expect(modalContent).toBeTruthy();
    });

    it("should render with full size", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()} size="full">
          Content
        </Modal>,
      );
      const modalContent = container.querySelector('[class*="w-\\[90vw\\]"]');
      expect(modalContent).toBeTruthy();
    });
  });

  describe("Close Button", () => {
    it("should render close button", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Content
        </Modal>,
      );
      const closeButton = container.querySelector(
        'button[aria-label="Close modal"]',
      );
      expect(closeButton).toBeTruthy();
    });

    it("should have close button icon", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Content
        </Modal>,
      );
      const closeButton = container.querySelector(
        'button[aria-label="Close modal"]',
      );
      const svg = closeButton?.querySelector("svg");
      expect(svg).toBeTruthy();
    });

    it("should call onClose when close button is clicked", async () => {
      const handleClose = vi.fn();
      const { container } = render(
        <Modal isOpen={true} onClose={handleClose}>
          Content
        </Modal>,
      );

      const closeButton = container.querySelector(
        'button[aria-label="Close modal"]',
      ) as HTMLButtonElement;

      const user = userEvent.setup();
      await user.click(closeButton);

      expect(handleClose).toHaveBeenCalled();
    });
  });

  describe("Overlay Click Dismiss", () => {
    it("should call onClose when backdrop is clicked", async () => {
      const handleClose = vi.fn();
      const { container } = render(
        <Modal isOpen={true} onClose={handleClose}>
          Content
        </Modal>,
      );

      const backdrop = container.firstChild as HTMLElement;
      const user = userEvent.setup();
      await user.click(backdrop);

      expect(handleClose).toHaveBeenCalled();
    });

    it("should not close when modal content is clicked", async () => {
      const handleClose = vi.fn();
      const { container } = render(
        <Modal isOpen={true} onClose={handleClose}>
          <button data-testid="content-button">Click me</button>
        </Modal>,
      );

      const button = screen.getByTestId("content-button");
      const user = userEvent.setup();
      await user.click(button);

      expect(handleClose).not.toHaveBeenCalled();
    });

    it("should have backdrop blur", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Content
        </Modal>,
      );
      const blurOverlay = container.querySelector(".backdrop-blur-sm");
      expect(blurOverlay).toBeTruthy();
    });

    it("should have semi-transparent background", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Content
        </Modal>,
      );
      const overlay = container.querySelector(".bg-black/50");
      expect(overlay).toBeTruthy();
    });
  });

  describe("Escape Key Dismiss", () => {
    it("should close modal on Escape key press", async () => {
      const handleClose = vi.fn();
      const { container } = render(
        <Modal isOpen={true} onClose={handleClose}>
          Content
        </Modal>,
      );

      const user = userEvent.setup();
      await user.keyboard("{Escape}");

      expect(handleClose).toHaveBeenCalled();
    });

    it("should not close if already closed", async () => {
      const handleClose = vi.fn();
      const { rerender } = render(
        <Modal isOpen={true} onClose={handleClose}>
          Content
        </Modal>,
      );

      rerender(
        <Modal isOpen={false} onClose={handleClose}>
          Content
        </Modal>,
      );

      const user = userEvent.setup();
      await user.keyboard("{Escape}");

      expect(handleClose).not.toHaveBeenCalled();
    });
  });

  describe("Footer", () => {
    it("should render footer when provided", () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} footer={<button>Save</button>}>
          Content
        </Modal>,
      );
      expect(screen.getByText("Save")).toBeTruthy();
    });

    it("should not render footer when not provided", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Content
        </Modal>,
      );
      const footerButtons = container.querySelectorAll(
        'div[class*="border-t"] button',
      );
      expect(footerButtons.length).toBe(1); // Only close button
    });

    it("should have footer styling", () => {
      const { container } = render(
        <Modal
          isOpen={true}
          onClose={vi.fn()}
          footer={<button>Footer Button</button>}
        >
          Content
        </Modal>,
      );
      const footer = container.querySelector(
        '[class*="border-t"][class*="bg-wl-bg-surface"]',
      );
      expect(footer).toBeTruthy();
    });

    it("should render custom footer content", () => {
      render(
        <Modal
          isOpen={true}
          onClose={vi.fn()}
          footer={
            <div>
              <button>Cancel</button>
              <button>Save</button>
            </div>
          }
        >
          Content
        </Modal>,
      );
      expect(screen.getByText("Cancel")).toBeTruthy();
      expect(screen.getByText("Save")).toBeTruthy();
    });
  });

  describe("Animations", () => {
    it("should have fadeIn animation", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Content
        </Modal>,
      );
      const backdrop = container.firstChild as HTMLElement;
      expect(backdrop?.className).toContain("animate-fadeIn");
    });

    it("should have slideIn animation on content", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Content
        </Modal>,
      );
      const content = container.querySelector('[class*="animate-slideIn"]');
      expect(content).toBeTruthy();
    });

    it("should have z-index of 51 for content", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Content
        </Modal>,
      );
      const content = container.querySelector('[class*="z-51"]');
      expect(content).toBeTruthy();
    });
  });

  describe("Body Overflow Lock", () => {
    beforeEach(() => {
      document.body.style.overflow = "";
    });

    afterEach(() => {
      document.body.style.overflow = "";
    });

    it("should lock body scroll when modal opens", () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Content
        </Modal>,
      );
      expect(document.body.style.overflow).toBe("hidden");
    });

    it("should unlock body scroll when modal closes", () => {
      const { rerender } = render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Content
        </Modal>,
      );

      expect(document.body.style.overflow).toBe("hidden");

      rerender(
        <Modal isOpen={false} onClose={vi.fn()}>
          Content
        </Modal>,
      );

      expect(document.body.style.overflow).toBe("");
    });

    it("should unlock scroll on unmount", () => {
      const { unmount } = render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Content
        </Modal>,
      );

      expect(document.body.style.overflow).toBe("hidden");

      unmount();

      expect(document.body.style.overflow).toBe("");
    });
  });

  describe("Header Styling", () => {
    it("should have header with border", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()} title="Title">
          Content
        </Modal>,
      );
      const header = container.querySelector('[class*="border-b"]');
      expect(header).toBeTruthy();
    });

    it("should have min height on header", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()} title="Title">
          Content
        </Modal>,
      );
      const header = container.querySelector('[class*="min-h-15"]');
      expect(header).toBeTruthy();
    });

    it("should have title with correct styling", () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Modal Title">
          Content
        </Modal>,
      );
      const title = screen.getByText("Modal Title");
      expect(title.className).toContain("text-lg");
      expect(title.className).toContain("font-semibold");
      expect(title.className).toContain("text-wl-text-primary");
    });
  });

  describe("Content Area", () => {
    it("should have correct padding on body", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Content
        </Modal>,
      );
      const body = container.querySelector('[class*="px-5"][class*="py-5"]');
      expect(body).toBeTruthy();
    });

    it("should have max height with overflow", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Content
        </Modal>,
      );
      const content = container.querySelector('[class*="max-h-\\[90vh\\]"]');
      expect(content).toBeTruthy();
    });

    it("should allow scrolling of long content", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()}>
          <div style={{ height: "2000px" }}>Long Content</div>
        </Modal>,
      );
      const content = container.querySelector('[class*="overflow-y-auto"]');
      expect(content).toBeTruthy();
    });
  });

  describe("Element Attributes", () => {
    it("should have correct element types", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test">
          Content
        </Modal>,
      );
      const modal = container.firstChild;
      expect(modal?.nodeName).toBe("DIV");
    });

    it("should have aria-hidden on backdrop", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Content
        </Modal>,
      );
      const backdrop = container.querySelector('[aria-hidden="true"]');
      expect(backdrop).toBeTruthy();
    });

    it("should have close button aria-label", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Content
        </Modal>,
      );
      const closeButton = container.querySelector(
        'button[aria-label="Close modal"]',
      );
      expect(closeButton).toBeTruthy();
    });
  });

  describe("Styling Classes", () => {
    it("should have dark theme background", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Content
        </Modal>,
      );
      const content = container.querySelector('[class*="bg-wl-bg-elevated"]');
      expect(content).toBeTruthy();
    });

    it("should have border styling", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Content
        </Modal>,
      );
      const content = container.querySelector(
        '[class*="border-wl-border-subtle"]',
      );
      expect(content).toBeTruthy();
    });

    it("should have rounded corners", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Content
        </Modal>,
      );
      const content = container.querySelector('[class*="rounded-lg"]');
      expect(content).toBeTruthy();
    });

    it("should have shadow", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Content
        </Modal>,
      );
      const content = container.querySelector('[class*="shadow-lg"]');
      expect(content).toBeTruthy();
    });
  });

  describe("Complex Scenarios", () => {
    it("should handle rapid open/close", async () => {
      const handleClose = vi.fn();
      const { rerender } = render(
        <Modal isOpen={true} onClose={handleClose}>
          Content
        </Modal>,
      );

      rerender(
        <Modal isOpen={false} onClose={handleClose}>
          Content
        </Modal>,
      );

      rerender(
        <Modal isOpen={true} onClose={handleClose}>
          Content
        </Modal>,
      );

      expect(screen.getByText("Content")).toBeTruthy();
    });

    it("should handle title and footer together", () => {
      render(
        <Modal
          isOpen={true}
          onClose={vi.fn()}
          title="Confirm Delete"
          footer={
            <div>
              <button>Cancel</button>
              <button>Delete</button>
            </div>
          }
        >
          Are you sure you want to delete this item?
        </Modal>,
      );

      expect(screen.getByText("Confirm Delete")).toBeTruthy();
      expect(
        screen.getByText("Are you sure you want to delete this item?"),
      ).toBeTruthy();
      expect(screen.getByText("Cancel")).toBeTruthy();
      expect(screen.getByText("Delete")).toBeTruthy();
    });

    it("should handle size with long content", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()} size="lg">
          <div style={{ height: "1000px" }}>Long scrollable content</div>
        </Modal>,
      );
      expect(container.textContent).toContain("Long scrollable content");
    });
  });

  describe("Performance", () => {
    it("should not render when isOpen is false", () => {
      const { container } = render(
        <Modal isOpen={false} onClose={vi.fn()}>
          Content
        </Modal>,
      );
      expect(container.innerHTML).not.toContain("Content");
    });

    it("should clean up event listeners on unmount", () => {
      const { unmount } = render(
        <Modal isOpen={true} onClose={vi.fn()}>
          Content
        </Modal>,
      );

      unmount();

      // Verify no errors from detached listeners
      expect(document.body.style.overflow).toBe("");
    });
  });
});
