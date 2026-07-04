/**
 * Screen Reader Announcements
 * Live region management and accessible announcements
 */

import React, {
  useEffect,
  useRef,
  createContext,
  useContext,
  ReactNode,
} from "react";

/**
 * Live region component for screen reader announcements
 */
export function LiveRegion({
  children,
  mode = "polite",
  className,
}: {
  children: ReactNode;
  mode?: "polite" | "assertive";
  className?: string;
}): React.ReactElement {
  return React.createElement(
    "div",
    {
      role: "status",
      "aria-live": mode,
      "aria-atomic": "true",
      className: `sr-only ${className || ""}`,
    },
    children,
  );
}

/**
 * Store for managing announcements
 */
let announceQueue: Array<{
  message: string;
  mode: "polite" | "assertive";
  timestamp: number;
}> = [];

let liveRegionElement: HTMLDivElement | null = null;

/**
 * Initialize the live region element
 */
function initializeLiveRegion(): HTMLDivElement {
  if (liveRegionElement) return liveRegionElement;

  const region = document.createElement("div");
  region.id = "sr-announcer";
  region.setAttribute("role", "status");
  region.setAttribute("aria-live", "polite");
  region.setAttribute("aria-atomic", "true");
  region.className = "sr-only";
  document.body.appendChild(region);

  liveRegionElement = region;
  return region;
}

/**
 * Announce a message to screen readers
 */
export function announce(
  message: string,
  mode: "polite" | "assertive" = "polite",
): void {
  const region = initializeLiveRegion();

  announceQueue.push({ message, mode, timestamp: Date.now() });

  // Update aria-live attribute based on mode
  region.setAttribute("aria-live", mode);

  // Clear and set new content
  region.textContent = "";
  region.textContent = message;

  // Dequeue old announcements
  setTimeout(() => {
    announceQueue = announceQueue.filter(
      (item) => Date.now() - item.timestamp < 1000,
    );
  }, 1000);
}

/**
 * Announce route/page navigation
 */
export function announceRouteChange(title: string): void {
  announce(`Navigated to ${title}`, "assertive");
}

/**
 * Announce a completed action
 */
export function announceAction(message: string): void {
  announce(message, "polite");
}

/**
 * Announce an error (assertively)
 */
export function announceError(message: string): void {
  announce(`Error: ${message}`, "assertive");
}

/**
 * React hook for managing announcements
 */
export function useAnnounce(): {
  announce: (message: string, mode?: "polite" | "assertive") => void;
  announceAction: (message: string) => void;
  announceError: (message: string) => void;
} {
  return {
    announce,
    announceAction,
    announceError,
  };
}

/**
 * Context for announcer (optional, for shared state)
 */
type AnnouncerContextType = {
  announce: (message: string, mode?: "polite" | "assertive") => void;
};

const AnnouncerContext = createContext<AnnouncerContextType | undefined>(
  undefined,
);

export function AnnouncerProvider({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  const value: AnnouncerContextType = {
    announce,
  };

  return React.createElement(AnnouncerContext.Provider, { value }, children);
}

export function useAnnouncerContext(): AnnouncerContextType {
  const context = useContext(AnnouncerContext);
  if (!context) {
    throw new Error(
      "useAnnouncerContext must be used within AnnouncerProvider",
    );
  }
  return context;
}
