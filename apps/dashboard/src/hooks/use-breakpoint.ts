"use client";

import { useEffect, useState } from "react";

/**
 * Standard Tailwind breakpoints (mobile-first approach)
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Hook to detect current responsive breakpoint
 * Returns the current breakpoint name based on window width
 * SSR-safe with fallback to 'sm'
 *
 * @example
 * const breakpoint = useBreakpoint();
 * if (breakpoint === 'mobile') {
 *   // render mobile layout
 * }
 *
 * @returns Current breakpoint name ('sm' | 'md' | 'lg' | 'xl' | '2xl')
 */
export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("sm");

  useEffect(() => {
    // Set initial breakpoint
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      let newBreakpoint: Breakpoint = "sm";

      if (width >= BREAKPOINTS["2xl"]) {
        newBreakpoint = "2xl";
      } else if (width >= BREAKPOINTS.xl) {
        newBreakpoint = "xl";
      } else if (width >= BREAKPOINTS.lg) {
        newBreakpoint = "lg";
      } else if (width >= BREAKPOINTS.md) {
        newBreakpoint = "md";
      }

      setBreakpoint(newBreakpoint);
    };

    updateBreakpoint();

    // Debounced resize listener (300ms)
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateBreakpoint, 300);
    };

    window.addEventListener("resize", handleResize, { passive: true });
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  return breakpoint;
}

/**
 * Hook for custom media queries
 * Returns true/false based on whether the query matches
 * SSR-safe with fallback to false
 *
 * @example
 * const isWide = useMediaQuery("(min-width: 1024px)");
 * const isDark = useMediaQuery("(prefers-color-scheme: dark)");
 *
 * @param query - CSS media query string
 * @returns True if media query matches, false otherwise
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(false);

  useEffect(() => {
    // Set initial state
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    // Create listener with passive flag
    const handleChange = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };

    // Use addEventListener for better compatibility
    mediaQuery.addEventListener("change", handleChange, { passive: true });
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [query]);

  return matches;
}

/**
 * Convenience hook to detect mobile breakpoint (< 768px)
 *
 * @example
 * const isMobile = useIsMobile();
 *
 * @returns True if window width < 768px
 */
export function useIsMobile(): boolean {
  const breakpoint = useBreakpoint();
  return breakpoint === "sm";
}

/**
 * Convenience hook to detect tablet breakpoint (768px - 1024px)
 *
 * @example
 * const isTablet = useIsTablet();
 *
 * @returns True if window width is 768px - 1023px
 */
export function useIsTablet(): boolean {
  const breakpoint = useBreakpoint();
  return breakpoint === "md";
}

/**
 * Convenience hook to detect desktop breakpoint (>= 1024px)
 *
 * @example
 * const isDesktop = useIsDesktop();
 *
 * @returns True if window width >= 1024px
 */
export function useIsDesktop(): boolean {
  const breakpoint = useBreakpoint();
  return ["lg", "xl", "2xl"].includes(breakpoint);
}

/**
 * Hook to detect if device prefers reduced motion
 * Useful for accessibility and performance optimization
 *
 * @example
 * const prefersReducedMotion = usePrefersReducedMotion();
 *
 * @returns True if user prefers reduced motion
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduce-motion: reduce)");
}
