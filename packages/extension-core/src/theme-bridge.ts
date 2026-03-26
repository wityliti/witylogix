// @ts-nocheck
/**
 * Theme Bridge: Map Witylogix --wl-* CSS custom properties to JavaScript objects
 * 
 * This module enables checkout and POS extensions to read and observe theme tokens
 * from the parent dashboard frame, ensuring visual consistency across surfaces.
 * 
 * Usage:
 *   const tokens = await readThemeTokens();
 *   const unsubscribe = observeThemeChanges((newTokens) => { ... });
 */

import type { ThemeTokens, ColorScale, SemanticColorScale } from './types.ts';

/**
 * CSS custom properties keys that map to Witylogix design tokens
 * These mirror apps/dashboard/src/styles/tokens.css
 */
const THEME_PROPERTY_MAP = {
  // Color scales
  'primary': '--wl-primary-',
  'neutral': '--wl-neutral-',
  
  // Semantic colors
  'success': '--wl-success-',
  'warning': '--wl-warning-',
  'danger': '--wl-danger-',
  'info': '--wl-info-',
  
  // Text colors
  'text-primary': '--wl-text-primary',
  'text-secondary': '--wl-text-secondary',
  'text-tertiary': '--wl-text-tertiary',
  'text-inverse': '--wl-text-inverse',
  
  // Background colors
  'bg-root': '--wl-bg-root',
  'bg-surface': '--wl-bg-surface',
  'bg-elevated': '--wl-bg-elevated',
  'bg-overlay': '--wl-bg-overlay',
  'bg-sunken': '--wl-bg-sunken',
  'bg-sidebar': '--wl-bg-sidebar',
  
  // Border colors
  'border-subtle': '--wl-border-subtle',
  'border-default': '--wl-border-default',
  'border-strong': '--wl-border-strong',
  'border-focus': '--wl-border-focus',
  
  // Typography
  'font-sans': '--wl-font-sans',
  'font-mono': '--wl-font-mono',
  
  // Font sizes
  'text-xs': '--wl-text-xs',
  'text-sm': '--wl-text-sm',
  'text-base': '--wl-text-base',
  'text-md': '--wl-text-md',
  'text-lg': '--wl-text-lg',
  'text-xl': '--wl-text-xl',
  'text-2xl': '--wl-text-2xl',
  'text-3xl': '--wl-text-3xl',
  
  // Spacing
  'space-0': '--wl-space-0',
  'space-1': '--wl-space-1',
  'space-2': '--wl-space-2',
  'space-3': '--wl-space-3',
  'space-4': '--wl-space-4',
  'space-5': '--wl-space-5',
  'space-6': '--wl-space-6',
  'space-8': '--wl-space-8',
  'space-10': '--wl-space-10',
  'space-12': '--wl-space-12',
  
  // Radii
  'radius-sm': '--wl-radius-sm',
  'radius-md': '--wl-radius-md',
  'radius-lg': '--wl-radius-lg',
  'radius-full': '--wl-radius-full',
} as const;

/**
 * Color scale values (50 through 900)
 */
const COLOR_SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

/**
 * Get a single CSS custom property value from the document root
 * Falls back to accessing parent frame's computed style for extensions running in iframes
 * 
 * @param name - CSS custom property name (e.g., '--wl-primary-500')
 * @param fallback - Default value if property not found
 * @returns CSS value or fallback
 */
export function getThemeVar(name: string, fallback: string = ''): string {
  try {
    // Try reading from own document first
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (value) return value;
    
    // If running in iframe, try to read from parent frame's computed style
    if (window !== window.parent && window.parent) {
      try {
        const parentValue = window.parent.getComputedStyle(
          window.parent.document.documentElement
        ).getPropertyValue(name).trim();
        if (parentValue) return parentValue;
      } catch {
        // Cross-origin access restricted; silently fall back
      }
    }
    
    return fallback;
  } catch {
    return fallback;
  }
}

/**
 * Read all Witylogix theme tokens from CSS custom properties
 * This function constructs the complete ThemeTokens object by reading
 * --wl-* properties from the document root (or parent frame for iframes)
 * 
 * @returns Promise<ThemeTokens> - All theme tokens
 */
export async function readThemeTokens(): Promise<ThemeTokens> {
  return {
    colors: {
      primary: readColorScale('primary'),
      neutral: readColorScale('neutral'),
      success: readSemanticColors('success'),
      warning: readSemanticColors('warning'),
      danger: readSemanticColors('danger'),
      info: readSemanticColors('info'),
      text: {
        primary: getThemeVar('--wl-text-primary'),
        secondary: getThemeVar('--wl-text-secondary'),
        tertiary: getThemeVar('--wl-text-tertiary'),
        inverse: getThemeVar('--wl-text-inverse'),
      },
      border: {
        subtle: getThemeVar('--wl-border-subtle'),
        default: getThemeVar('--wl-border-default'),
        strong: getThemeVar('--wl-border-strong'),
        focus: getThemeVar('--wl-border-focus'),
      },
      background: {
        root: getThemeVar('--wl-bg-root'),
        surface: getThemeVar('--wl-bg-surface'),
        elevated: getThemeVar('--wl-bg-elevated'),
        overlay: getThemeVar('--wl-bg-overlay'),
        sunken: getThemeVar('--wl-bg-sunken'),
        sidebar: getThemeVar('--wl-bg-sidebar'),
      },
    },
    spacing: {
      0: getThemeVar('--wl-space-0'),
      1: getThemeVar('--wl-space-1'),
      2: getThemeVar('--wl-space-2'),
      3: getThemeVar('--wl-space-3'),
      4: getThemeVar('--wl-space-4'),
      5: getThemeVar('--wl-space-5'),
      6: getThemeVar('--wl-space-6'),
      8: getThemeVar('--wl-space-8'),
      10: getThemeVar('--wl-space-10'),
      12: getThemeVar('--wl-space-12'),
    },
    typography: {
      fontSans: getThemeVar('--wl-font-sans'),
      fontMono: getThemeVar('--wl-font-mono'),
      sizes: {
        xs: getThemeVar('--wl-text-xs'),
        sm: getThemeVar('--wl-text-sm'),
        base: getThemeVar('--wl-text-base'),
        md: getThemeVar('--wl-text-md'),
        lg: getThemeVar('--wl-text-lg'),
        xl: getThemeVar('--wl-text-xl'),
        '2xl': getThemeVar('--wl-text-2xl'),
        '3xl': getThemeVar('--wl-text-3xl'),
      },
      weights: {
        light: 300,
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
      },
    },
    radii: {
      sm: getThemeVar('--wl-radius-sm', '4px'),
      md: getThemeVar('--wl-radius-md', '8px'),
      lg: getThemeVar('--wl-radius-lg', '12px'),
      full: getThemeVar('--wl-radius-full', '9999px'),
    },
    colorScheme: detectColorScheme(),
  };
}

/**
 * Read a color scale (e.g., primary-50, primary-100, ..., primary-900)
 * @internal
 */
function readColorScale(colorName: string): ColorScale {
  const scale: Record<number, string> = {};
  for (const step of COLOR_SCALE_STEPS) {
    scale[step] = getThemeVar(`--wl-${colorName}-${step}`);
  }
  return scale as ColorScale;
}

/**
 * Read semantic color values (400, 500, 600, bg)
 * @internal
 */
function readSemanticColors(colorName: string): SemanticColorScale {
  return {
    400: getThemeVar(`--wl-${colorName}-400`),
    500: getThemeVar(`--wl-${colorName}-500`),
    600: getThemeVar(`--wl-${colorName}-600`),
    bg: getThemeVar(`--wl-${colorName}-bg`),
  };
}

/**
 * Detect dark/light color scheme
 * Uses prefers-color-scheme media query first, falls back to manual detection
 * via --wl-bg-root luminance
 * 
 * @returns 'light' | 'dark'
 */
export function detectColorScheme(): 'light' | 'dark' {
  // Check CSS media query first
  if (typeof window !== 'undefined' && window.matchMedia) {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
  }
  
  // Fall back to analyzing --wl-bg-root color luminance
  const bgRoot = getThemeVar('--wl-bg-root', '#ffffff');
  const isDark = isColorDark(bgRoot);
  
  return isDark ? 'dark' : 'light';
}

/**
 * Determine if a color is dark based on relative luminance
 * Uses WCAG formula: (0.299 * R + 0.587 * G + 0.114 * B) / 255
 * 
 * @param color - CSS color string (hex, rgb, etc.)
 * @returns boolean - True if color is dark
 * @internal
 */
function isColorDark(color: string): boolean {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    
    const imageData = ctx.getImageData(0, 0, 1, 1);
    const [r, g, b] = imageData.data;
    
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  } catch {
    // If color parsing fails, assume light theme
    return false;
  }
}

/**
 * Subscribe to theme token changes
 * Observes CSS custom property mutations and re-reads theme on change
 * Also watches for prefers-color-scheme media query changes
 * 
 * @param callback - Called with new ThemeTokens when theme changes
 * @returns Unsubscribe function
 */
export function observeThemeChanges(
  callback: (tokens: ThemeTokens) => void
): () => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  // Debounced re-read function (theme changes often batch multiple properties)
  const debouncedReread = () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(async () => {
      const newTokens = await readThemeTokens();
      callback(newTokens);
    }, 50);
  };
  
  // Watch for CSS custom property changes
  const observer = new MutationObserver(debouncedReread);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['style'],
    subtree: false,
  });
  
  // Watch for prefers-color-scheme media query changes
  let mediaQueryList: MediaQueryList | null = null;
  if (typeof window !== 'undefined' && window.matchMedia) {
    mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = () => {
      debouncedReread();
    };
    
    // Use addEventListener if available (modern browsers)
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', handleMediaChange);
    } else {
      // Fallback for older browsers
      mediaQueryList.addListener(handleMediaChange);
    }
  }
  
  // Return unsubscribe function
  return () => {
    observer.disconnect();
    if (timeoutId) clearTimeout(timeoutId);
    if (mediaQueryList) {
      if (mediaQueryList.removeEventListener) {
        mediaQueryList.removeEventListener('change', () => {});
      } else {
        mediaQueryList.removeListener(() => {});
      }
    }
  };
}

/**
 * Cache theme tokens in localStorage for quick startup
 * Useful for avoiding flash of default colors on extension load
 * 
 * @internal
 */
function cacheThemeTokens(tokens: ThemeTokens): void {
  try {
    // Only cache if in iframe sandbox that allows localStorage
    if (typeof window === 'undefined' || !window.localStorage) return;
    
    localStorage.setItem(
      '__wl_theme_cache',
      JSON.stringify({
        timestamp: Date.now(),
        tokens,
      })
    );
  } catch {
    // Silently ignore localStorage errors (quota exceeded, sandboxed context, etc.)
  }
}

/**
 * Retrieve cached theme tokens from localStorage
 * Returns null if cache is stale (> 24 hours) or unavailable
 * 
 * @internal
 */
function getCachedThemeTokens(): ThemeTokens | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    
    const cached = localStorage.getItem('__wl_theme_cache');
    if (!cached) return null;
    
    const { timestamp, tokens } = JSON.parse(cached);
    const age = Date.now() - timestamp;
    const isStale = age > 24 * 60 * 60 * 1000; // 24 hours
    
    return isStale ? null : tokens;
  } catch {
    return null;
  }
}

/**
 * Preload theme tokens for immediate availability
 * Useful to call during extension initialization before rendering
 * Stores tokens in window.__WL_THEME_TOKENS__ for access in useTheme() hook
 * 
 * @returns Promise<ThemeTokens> - Preloaded theme tokens
 */
export async function preloadThemeTokens(): Promise<ThemeTokens> {
  // Try cache first for fast startup
  let tokens = getCachedThemeTokens();
  
  if (!tokens) {
    // Read fresh tokens from DOM
    tokens = await readThemeTokens();
    // Cache for next load
    cacheThemeTokens(tokens);
  }
  
  // Store in global for sync access
  if (typeof window !== 'undefined') {
    (window as any).__WL_THEME_TOKENS__ = tokens;
  }
  
  return tokens;
}

/**
 * Get synchronously-cached theme tokens (populated by preloadThemeTokens)
 * Returns default fallback tokens if not yet loaded
 * 
 * @returns ThemeTokens - Cached tokens or sensible defaults
 * @internal
 */
export function getCachedOrDefaultThemes(): ThemeTokens {
  if (typeof window !== 'undefined' && (window as any).__WL_THEME_TOKENS__) {
    return (window as any).__WL_THEME_TOKENS__ as ThemeTokens;
  }
  
  // Fallback to Witylogix defaults (can be overridden)
  return {
    colors: {
      primary: {
        50: '#fff9eb', 100: '#ffefc4', 200: '#ffe09d', 300: '#ffd06a',
        400: '#ffc240', 500: '#f5a623', 600: '#d98b0a', 700: '#b06f05',
        800: '#8d5704', 900: '#6b4203',
      },
      neutral: {
        50: '#f8f8fa', 100: '#ececf1', 200: '#d5d5dd', 300: '#b0b0bf',
        400: '#8585a0', 500: '#62627e', 600: '#4a4a62', 700: '#35354a',
        800: '#232336', 900: '#17172a',
      },
      success: { 400: '#34d399', 500: '#10b981', 600: '#059669', bg: 'rgba(16, 185, 129, 0.12)' },
      warning: { 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', bg: 'rgba(245, 158, 11, 0.12)' },
      danger: { 400: '#f87171', 500: '#ef4444', 600: '#dc2626', bg: 'rgba(239, 68, 68, 0.12)' },
      info: { 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', bg: 'rgba(59, 130, 246, 0.12)' },
      text: { primary: '#f0f0f5', secondary: '#9494ac', tertiary: '#5e5e78', inverse: '#0a0a0c' },
      border: { subtle: 'rgba(255, 255, 255, 0.06)', default: 'rgba(255, 255, 255, 0.10)', strong: 'rgba(255, 255, 255, 0.16)', focus: '#f5a623' },
      background: { root: '#0a0a0c', surface: '#111114', elevated: '#19191e', overlay: '#1f1f26', sunken: '#07070a', sidebar: '#0c0c10' },
    },
    spacing: {
      0: '0', 1: '0.25rem', 2: '0.5rem', 3: '0.75rem', 4: '1rem',
      5: '1.25rem', 6: '1.5rem', 8: '2rem', 10: '2.5rem', 12: '3rem',
    },
    typography: {
      fontSans: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontMono: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
      sizes: {
        xs: '0.6875rem', sm: '0.8125rem', base: '0.875rem', md: '0.9375rem',
        lg: '1.0625rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem',
      },
      weights: { light: 300, normal: 400, medium: 500, semibold: 600, bold: 700 },
    },
    radii: { sm: '4px', md: '8px', lg: '12px', full: '9999px' },
    colorScheme: 'dark',
  };
}
