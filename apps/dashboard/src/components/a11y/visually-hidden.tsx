/**
 * Visually Hidden Component
 * Content visible only to screen readers, properly hidden from visual users
 */

import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface VisuallyHiddenProps {
  children: ReactNode;
  className?: string;
  asChild?: boolean;
}

/**
 * VisuallyHidden component for screen reader-only content
 * Uses sr-only pattern that maintains accessibility while hiding visually
 */
export function VisuallyHidden({
  children,
  className,
}: VisuallyHiddenProps): React.ReactElement {
  return (
    <span
      className={cn(
        "sr-only absolute w-1 h-1 p-0 -m-1 overflow-hidden " +
          "clip-path-inset-50 whitespace-nowrap border-0",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Alternative: visually hidden div for larger content sections
 */
export function VisuallyHiddenDiv({
  children,
  className,
}: Omit<VisuallyHiddenProps, "asChild">): React.ReactElement {
  return (
    <div
      className={cn(
        "sr-only absolute w-1 h-1 p-0 -m-1 overflow-hidden " +
          "clip-path-inset-50 whitespace-nowrap border-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Visually hidden label for form inputs
 */
export function VisuallyHiddenLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: ReactNode;
}): React.ReactElement {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "sr-only absolute w-1 h-1 p-0 -m-1 overflow-hidden " +
          "clip-path-inset-50 whitespace-nowrap border-0",
      )}
    >
      {children}
    </label>
  );
}

export { VisuallyHidden as default };
