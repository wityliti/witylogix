/**
 * Reduced Motion Support
 * Respect user's prefers-reduced-motion media query
 */

import { useEffect, useState, ReactNode } from 'react';

/**
 * Hook to detect user's motion preferences
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check initial preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    // Listen for changes
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

/**
 * Component that only renders children if motion is acceptable
 */
export function MotionSafe({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}): ReactNode {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return fallback;
  }

  return children;
}

/**
 * Get adaptive animation duration based on user preference
 */
export function getAnimationDuration(
  normal: number,
  reduced: number = 0
): number {
  const prefersReducedMotion = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return prefersReducedMotion ? reduced : normal;
}

/**
 * Get Tailwind transition class based on motion preference
 */
export function getTransitionClass(
  normalClass: string = 'transition-all duration-200 ease-in-out'
): string {
  const prefersReducedMotion = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    return 'transition-none';
  }

  return normalClass;
}

/**
 * CSS-in-JS helper for animation based on motion preference
 */
export function getAnimationStyle(
  normalAnimation: string,
  reducedAnimation?: string
): Record<string, string> {
  const prefersReducedMotion = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return {
    animation: prefersReducedMotion
      ? reducedAnimation || 'none'
      : normalAnimation,
  };
}

/**
 * Media query helper for respecting motion preferences
 */
export function createMotionMediaQuery(): {
  matches: boolean;
  addListener: (callback: (matches: boolean) => void) => () => void;
} {
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  return {
    matches: mediaQuery.matches,
    addListener: (callback: (matches: boolean) => void) => {
      const handler = (e: MediaQueryListEvent) => callback(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    },
  };
}
