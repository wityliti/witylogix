/**
 * Focus Management Utilities
 * Provides keyboard and programmatic focus control for accessible components
 */

import { useRef, useEffect } from "react";

/**
 * Query all focusable elements within a container
 */
export function getFocusableElements(
  container: HTMLElement | null,
): HTMLElement[] {
  if (!container) return [];

  const focusableSelectors = [
    "button:not([disabled])",
    "a[href]",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ];

  return Array.from(
    container.querySelectorAll<HTMLElement>(focusableSelectors.join(",")),
  ).filter((el) => isVisible(el));
}

/**
 * Check if element is visible (not hidden by display, visibility, etc)
 */
function isVisible(element: HTMLElement): boolean {
  return !!(
    element.offsetParent !== null ||
    getComputedStyle(element).display !== "none"
  );
}

/**
 * Check if an element can receive focus
 */
export function isFocusable(element: HTMLElement): boolean {
  if (!isVisible(element)) return false;

  const tagName = element.tagName.toLowerCase();
  const tabIndex = element.getAttribute("tabindex");

  // Elements that are naturally focusable
  if (["button", "a", "input", "select", "textarea"].includes(tagName)) {
    return !element.hasAttribute("disabled");
  }

  // Elements with explicit tabindex > -1
  if (tabIndex !== null && !isNaN(parseInt(tabIndex, 10))) {
    const tabIndexNum = parseInt(tabIndex, 10);
    return tabIndexNum >= 0;
  }

  return false;
}

/**
 * Focus the first focusable element in a container
 */
export function focusFirst(container: HTMLElement | null): void {
  const focusables = getFocusableElements(container);
  focusables[0]?.focus();
}

/**
 * Focus the last focusable element in a container
 */
export function focusLast(container: HTMLElement | null): void {
  const focusables = getFocusableElements(container);
  focusables[focusables.length - 1]?.focus();
}

/**
 * Move focus forward or backward through focusable elements
 */
export function moveFocus(
  direction: "forward" | "backward",
  container: HTMLElement | null = document.body,
): void {
  const focusables = getFocusableElements(container);
  const currentElement = document.activeElement as HTMLElement | null;
  const currentIndex = currentElement ? focusables.indexOf(currentElement) : -1;

  if (focusables.length === 0) return;

  let nextIndex: number;
  if (currentIndex === -1) {
    nextIndex = direction === "forward" ? 0 : focusables.length - 1;
  } else {
    nextIndex =
      direction === "forward"
        ? (currentIndex + 1) % focusables.length
        : (currentIndex - 1 + focusables.length) % focusables.length;
  }

  focusables[nextIndex]?.focus();
}

/**
 * Trap focus within a container (prevent Tab/Shift+Tab from leaving)
 */
export function trapFocus(container: HTMLElement | null): (() => void) | null {
  if (!container) return null;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;

    const focusables = getFocusableElements(container);
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }

    const firstFocusable = focusables[0];
    const lastFocusable = focusables[focusables.length - 1];
    const activeElement = document.activeElement;

    // Shift+Tab on first element: focus last
    if (e.shiftKey && activeElement === firstFocusable) {
      e.preventDefault();
      lastFocusable.focus();
      return;
    }

    // Tab on last element: focus first
    if (!e.shiftKey && activeElement === lastFocusable) {
      e.preventDefault();
      firstFocusable.focus();
      return;
    }
  };

  container.addEventListener("keydown", handleKeyDown);
  return () => container.removeEventListener("keydown", handleKeyDown);
}

/**
 * Restore focus to the previously focused element
 */
export function restoreFocus(previousElement: HTMLElement | null): void {
  if (previousElement && isFocusable(previousElement)) {
    previousElement.focus();
  }
}

/**
 * React hook for focus trapping in modals/dialogs
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement>,
  options: { initialFocus?: "first" | "last" } = {},
): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Store the previously focused element
    const previousElement = document.activeElement as HTMLElement;

    // Focus initial element
    if (options.initialFocus === "last") {
      focusLast(container);
    } else {
      focusFirst(container);
    }

    // Set up focus trap
    const cleanup = trapFocus(container);

    // Cleanup: restore focus and remove trap
    return () => {
      cleanup?.();
      restoreFocus(previousElement);
    };
  }, [containerRef, options]);
}
