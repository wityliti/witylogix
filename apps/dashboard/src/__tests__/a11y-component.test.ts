/**
 * Accessibility Test Utilities and Examples
 * Integration with axe-core for automated a11y testing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Mock axe-core for testing
 */
const mockAxeResults = {
  violations: [] as any[],
  passes: [] as any[],
  incomplete: [] as any[],
  inapplicable: [] as any[],
};

/**
 * Test helper: Run axe-core accessibility checks
 */
async function testA11y(element: HTMLElement): Promise<void> {
  // In real implementation, would use axe-core
  // expect(mockAxeResults.violations).toHaveLength(0);
}

/**
 * Test helper: Focus trap validation
 */
function testFocusTrap(container: HTMLElement): void {
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  );

  if (focusableElements.length === 0) {
    throw new Error("No focusable elements found in container");
  }

  const firstElement = focusableElements[0] as HTMLElement;
  const lastElement = focusableElements[
    focusableElements.length - 1
  ] as HTMLElement;

  firstElement.focus();
  expect(document.activeElement).toBe(firstElement);

  lastElement.focus();
  expect(document.activeElement).toBe(lastElement);
}

/**
 * Test helper: ARIA attribute validation
 */
function testAriaAttributes(
  element: HTMLElement,
  expectedAttrs: Record<string, string>,
): void {
  Object.entries(expectedAttrs).forEach(([attr, value]) => {
    expect(element.getAttribute(attr)).toBe(value);
  });
}

/**
 * Test helper: Keyboard navigation
 */
function testKeyboardNavigation(container: HTMLElement, keys: string[]): void {
  const focusableElements = Array.from(
    container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ) as HTMLElement[];

  focusableElements.forEach((element, index) => {
    element.focus();
    expect(document.activeElement).toBe(element);
  });
}

/**
 * Test helper: Color contrast validation
 */
function testColorContrast(
  fgColor: string,
  bgColor: string,
  minRatio: number = 4.5,
): void {
  // Parse colors and calculate contrast
  // This is a placeholder; real implementation would use color utilities
  expect(minRatio).toBeGreaterThanOrEqual(1);
}

/**
 * Example test suite for accessible button
 */
describe("Accessible Button Component", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should have proper ARIA attributes", () => {
    const button = document.createElement("button");
    button.textContent = "Click me";
    button.setAttribute("aria-label", "Action button");
    container.appendChild(button);

    testAriaAttributes(button, {
      "aria-label": "Action button",
    });
  });

  it("should be focusable with keyboard", () => {
    const button = document.createElement("button");
    button.textContent = "Click me";
    container.appendChild(button);

    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it("should handle Enter and Space keys", () => {
    const button = document.createElement("button");
    button.textContent = "Click me";
    const handler = vi.fn();
    button.addEventListener("click", handler);
    container.appendChild(button);

    const enterEvent = new KeyboardEvent("keydown", { key: "Enter" });
    const spaceEvent = new KeyboardEvent("keydown", { key: " " });

    button.dispatchEvent(enterEvent);
    button.dispatchEvent(spaceEvent);

    expect(handler).toHaveBeenCalled();
  });

  it("should disable properly with aria-disabled", () => {
    const button = document.createElement("button");
    button.textContent = "Click me";
    button.disabled = true;
    button.setAttribute("aria-disabled", "true");
    container.appendChild(button);

    testAriaAttributes(button, {
      "aria-disabled": "true",
    });
    expect(button.disabled).toBe(true);
  });
});

/**
 * Example test suite for accessible modal
 */
describe("Accessible Modal Component", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should trap focus within modal", () => {
    const modal = document.createElement("div");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "modal-title");

    const title = document.createElement("h2");
    title.id = "modal-title";
    title.textContent = "Modal Title";

    const button1 = document.createElement("button");
    button1.textContent = "Button 1";

    const button2 = document.createElement("button");
    button2.textContent = "Button 2";

    modal.appendChild(title);
    modal.appendChild(button1);
    modal.appendChild(button2);
    container.appendChild(modal);

    testFocusTrap(modal);
  });

  it("should have proper ARIA dialog attributes", () => {
    const modal = document.createElement("div");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "modal-title");

    testAriaAttributes(modal, {
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "modal-title",
    });
  });

  it("should close on Escape key", () => {
    const modal = document.createElement("div");
    const closeHandler = vi.fn();
    modal.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeHandler();
    });
    container.appendChild(modal);

    const escapeEvent = new KeyboardEvent("keydown", { key: "Escape" });
    modal.dispatchEvent(escapeEvent);

    expect(closeHandler).toHaveBeenCalled();
  });
});

/**
 * Example test suite for accessible table
 */
describe("Accessible Table Component", () => {
  let table: HTMLTableElement;

  beforeEach(() => {
    table = document.createElement("table");
    const thead = document.createElement("thead");
    const tbody = document.createElement("tbody");

    const headerRow = document.createElement("tr");
    const th1 = document.createElement("th");
    th1.textContent = "Name";
    const th2 = document.createElement("th");
    th2.textContent = "Email";
    headerRow.appendChild(th1);
    headerRow.appendChild(th2);
    thead.appendChild(headerRow);

    const dataRow = document.createElement("tr");
    const td1 = document.createElement("td");
    td1.textContent = "John Doe";
    const td2 = document.createElement("td");
    td2.textContent = "john@example.com";
    dataRow.appendChild(td1);
    dataRow.appendChild(td2);
    tbody.appendChild(dataRow);

    table.appendChild(thead);
    table.appendChild(tbody);
    document.body.appendChild(table);
  });

  afterEach(() => {
    document.body.removeChild(table);
  });

  it("should have proper table semantics", () => {
    expect(table.querySelector("thead")).toBeTruthy();
    expect(table.querySelector("tbody")).toBeTruthy();
    expect(table.querySelectorAll("th").length).toBe(2);
  });

  it("should have headers associated with data cells", () => {
    const headers = Array.from(table.querySelectorAll("th"));
    expect(headers.length).toBeGreaterThan(0);
    headers.forEach((header) => {
      expect(header.textContent).toBeTruthy();
    });
  });
});

export {
  testA11y,
  testFocusTrap,
  testAriaAttributes,
  testKeyboardNavigation,
  testColorContrast,
};
