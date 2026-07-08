/**
 * ARIA Attribute Helpers
 * Utilities for managing ARIA attributes and properties
 */

import { useEffect, useState, useRef, useCallback } from "react";

/**
 * Generate unique IDs for ARIA associations
 */
const idMap = new Map<string, number>();

export function generateId(prefix: string = "id"): string {
  const count = (idMap.get(prefix) || 0) + 1;
  idMap.set(prefix, count);
  return `${prefix}-${count}`;
}

/**
 * Hook for managing aria-expanded state
 */
export function useAriaExpanded(isOpen: boolean): {
  ariaExpanded: boolean;
  setAriaExpanded: (value: boolean) => void;
} {
  const [ariaExpanded, setAriaExpanded] = useState(isOpen);

  useEffect(() => {
    setAriaExpanded(isOpen);
  }, [isOpen]);

  return { ariaExpanded, setAriaExpanded };
}

/**
 * Hook for managing aria-selected state
 */
export function useAriaSelected(isSelected: boolean): {
  ariaSelected: boolean;
  setAriaSelected: (value: boolean) => void;
} {
  const [ariaSelected, setAriaSelected] = useState(isSelected);

  useEffect(() => {
    setAriaSelected(isSelected);
  }, [isSelected]);

  return { ariaSelected, setAriaSelected };
}

/**
 * Hook for managing aria-describedby
 * Maps description IDs dynamically
 */
export function useAriaDescribedBy(
  descriptions: Array<string | null | undefined>,
): {
  ariaDescribedBy: string;
  registerDescription: (id: string) => void;
} {
  const [describedByIds, setDescribedByIds] = useState<string[]>([]);

  useEffect(() => {
    const ids = descriptions.filter(
      (id): id is string => id !== null && id !== undefined,
    );
    setDescribedByIds(ids);
  }, [descriptions]);

  const registerDescription = useCallback((id: string) => {
    setDescribedByIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  return {
    ariaDescribedBy: describedByIds.join(" "),
    registerDescription,
  };
}

/**
 * Hook for managing aria-labelledby
 * Maps label IDs dynamically
 */
export function useAriaLabelledBy(labels: Array<string | null | undefined>): {
  ariaLabelledBy: string;
  registerLabel: (id: string) => void;
} {
  const [labelledByIds, setLabelledByIds] = useState<string[]>([]);

  useEffect(() => {
    const ids = labels.filter(
      (id): id is string => id !== null && id !== undefined,
    );
    setLabelledByIds(ids);
  }, [labels]);

  const registerLabel = useCallback((id: string) => {
    setLabelledByIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  return {
    ariaLabelledBy: labelledByIds.join(" "),
    registerLabel,
  };
}

/**
 * Hook for managing aria-live regions
 */
export function useAriaLive(mode: "polite" | "assertive" | "off" = "polite"): {
  ariaLive: "polite" | "assertive" | "off";
  ariaAtomic: boolean;
  setAriaLive: (mode: "polite" | "assertive" | "off") => void;
} {
  const [ariaLive, setAriaLive] = useState<"polite" | "assertive" | "off">(
    mode,
  );

  return {
    ariaLive,
    ariaAtomic: true,
    setAriaLive,
  };
}

/**
 * Utility type for ARIA attributes
 */
export type AriaAttributes = {
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-expanded"?: boolean;
  "aria-selected"?: boolean;
  "aria-disabled"?: boolean;
  "aria-hidden"?: boolean;
  "aria-live"?: "polite" | "assertive" | "off";
  "aria-atomic"?: boolean;
  "aria-busy"?: boolean;
  "aria-checked"?: boolean | "mixed";
  "aria-current"?:
    | "page"
    | "step"
    | "location"
    | "date"
    | "time"
    | true
    | false;
  "aria-pressed"?: boolean | "mixed";
  "aria-required"?: boolean;
  "aria-invalid"?: boolean;
  "aria-readonly"?: boolean;
  "aria-multiselectable"?: boolean;
  "aria-haspopup"?:
    | "true"
    | "menu"
    | "listbox"
    | "tree"
    | "grid"
    | "dialog"
    | false;
  "aria-modal"?: boolean;
};

/**
 * Build ARIA attributes object from individual values
 */
export function buildAriaAttributes(
  attrs: Partial<AriaAttributes>,
): Partial<AriaAttributes> {
  return Object.fromEntries(
    Object.entries(attrs).filter(
      ([, value]) => value !== undefined && value !== null,
    ),
  );
}

/**
 * Get ARIA attribute value from element
 */
export function getAriaAttribute(
  element: HTMLElement,
  attribute: keyof AriaAttributes,
): string | null {
  return element.getAttribute(attribute);
}

/**
 * Set ARIA attribute on element
 */
export function setAriaAttribute(
  element: HTMLElement,
  attribute: keyof AriaAttributes,
  value: string | boolean | null,
): void {
  if (value === null || value === undefined) {
    element.removeAttribute(attribute);
  } else {
    element.setAttribute(attribute, String(value));
  }
}

/**
 * Hook to bind ARIA attributes to element ref
 */
export function useAriaBinding(
  ref: React.RefObject<HTMLElement>,
  attrs: Partial<AriaAttributes>,
): void {
  useEffect(() => {
    if (!ref.current) return;

    Object.entries(attrs).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        ref.current?.removeAttribute(key);
      } else {
        ref.current?.setAttribute(key, String(value));
      }
    });
  }, [ref, attrs]);
}
