"use client";

/**
 * Read a `--wl-*` CSS variable from :root and return its resolved string.
 * Runs in the browser only — returns '' during SSR.
 */
export function resolveToken(name: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

export interface MapTokens {
  strokeDefault: string;
  strokeSelected: string;
  fillGood: string;
  fillWatch: string;
  fillSlipping: string;
  label: string;
  labelHalo: string;
  hubFill: string;
  pinOpen: string;
  pinAssigned: string;
  pinInTransit: string;
  pinDelayed: string;
}

export const mapTokens = (): MapTokens => ({
  strokeDefault: resolveToken("--wl-neutral-700") || "#35354a",
  strokeSelected: resolveToken("--wl-primary-500") || "#f5a623",
  fillGood: resolveToken("--wl-success-500") || "#10b981",
  fillWatch: resolveToken("--wl-warning-500") || "#f59e0b",
  fillSlipping: resolveToken("--wl-danger-500") || "#ef4444",
  label: resolveToken("--wl-neutral-200") || "#d5d5dd",
  labelHalo: resolveToken("--wl-bg-root") || "#0a0a0c",
  hubFill: resolveToken("--wl-primary-500") || "#f5a623",
  pinOpen: resolveToken("--wl-info-400") || "#60a5fa",
  pinAssigned: resolveToken("--wl-primary-500") || "#f5a623",
  pinInTransit: resolveToken("--wl-success-500") || "#10b981",
  pinDelayed: resolveToken("--wl-danger-500") || "#ef4444",
});
