/**
 * Color Contrast Utilities
 * WCAG compliance checking and color contrast analysis
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Parse color string to RGB values
 * Supports: hex (#fff, #ffffff), rgb(r,g,b), hsl(h,s%,l%)
 */
export function parseColor(color: string): RGB {
  const trimmed = color.trim();

  // Handle hex colors
  if (trimmed.startsWith('#')) {
    return parseHexColor(trimmed);
  }

  // Handle rgb() colors
  if (trimmed.startsWith('rgb')) {
    return parseRgbColor(trimmed);
  }

  // Handle hsl() colors
  if (trimmed.startsWith('hsl')) {
    return parseHslColor(trimmed);
  }

  // Default to black if unparseable
  return { r: 0, g: 0, b: 0 };
}

function parseHexColor(hex: string): RGB {
  let h = hex.replace('#', '');

  // Expand shorthand (e.g., #fff -> #ffffff)
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }

  const num = parseInt(h, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function parseRgbColor(rgb: string): RGB {
  const match = rgb.match(/\d+/g);
  if (!match || match.length < 3) return { r: 0, g: 0, b: 0 };

  return {
    r: parseInt(match[0], 10),
    g: parseInt(match[1], 10),
    b: parseInt(match[2], 10),
  };
}

function parseHslColor(hsl: string): RGB {
  const match = hsl.match(/(\d+(?:\.\d+)?)/g);
  if (!match || match.length < 3) return { r: 0, g: 0, b: 0 };

  const h = parseFloat(match[0]) / 360;
  const s = parseFloat(match[1]) / 100;
  const l = parseFloat(match[2]) / 100;

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Calculate relative luminance of a color (WCAG formula)
 */
export function getRelativeLuminance(rgb: RGB): number {
  const [rs, gs, bs] = [rgb.r, rgb.g, rgb.b].map((val) => {
    const normalized = val / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 * Returns a value between 1 and 21
 */
export function calculateContrastRatio(
  fgColor: string,
  bgColor: string
): number {
  const fgRGB = parseColor(fgColor);
  const bgRGB = parseColor(bgColor);

  const fgLuminance = getRelativeLuminance(fgRGB);
  const bgLuminance = getRelativeLuminance(bgRGB);

  const lighter = Math.max(fgLuminance, bgLuminance);
  const darker = Math.min(fgLuminance, bgLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check WCAG AA compliance
 * Requires 4.5:1 for normal text, 3:1 for large text (18pt+ or 14pt+ bold)
 */
export function meetsAA(ratio: number, size: 'normal' | 'large' = 'normal'): boolean {
  return size === 'large' ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Check WCAG AAA compliance
 * Requires 7:1 for normal text, 4.5:1 for large text
 */
export function meetsAAA(ratio: number, size: 'normal' | 'large' = 'normal'): boolean {
  return size === 'large' ? ratio >= 4.5 : ratio >= 7;
}

/**
 * Suggest an accessible color to meet target contrast
 * Lightens or darkens the foreground color to meet requirements
 */
export function suggestAccessibleColor(
  fgColor: string,
  bgColor: string,
  targetRatio: number = 4.5
): string {
  let fgRGB = parseColor(fgColor);
  let currentRatio = calculateContrastRatio(fgColor, bgColor);

  // Already meets target
  if (currentRatio >= targetRatio) {
    return fgColor;
  }

  const bgRGB = parseColor(bgColor);
  const bgLuminance = getRelativeLuminance(bgRGB);

  // Try lightening or darkening the foreground
  const isLightBg = bgLuminance > 0.5;
  const step = isLightBg ? -10 : 10; // Darken if light bg, lighten if dark bg

  for (let i = 0; i < 256; i++) {
    fgRGB = {
      r: Math.max(0, Math.min(255, fgRGB.r + step)),
      g: Math.max(0, Math.min(255, fgRGB.g + step)),
      b: Math.max(0, Math.min(255, fgRGB.b + step)),
    };

    const rgb2hex = `#${[fgRGB.r, fgRGB.g, fgRGB.b]
      .map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('')}`;

    currentRatio = calculateContrastRatio(rgb2hex, bgColor);
    if (currentRatio >= targetRatio) {
      return rgb2hex;
    }
  }

  // Fallback to pure black or white
  return isLightBg ? '#000000' : '#FFFFFF';
}

/**
 * Get contrast analysis for color pair
 */
export function analyzeContrast(
  fgColor: string,
  bgColor: string
): {
  ratio: number;
  aa: boolean;
  aaa: boolean;
  aaLarge: boolean;
  aaaLarge: boolean;
} {
  const ratio = calculateContrastRatio(fgColor, bgColor);

  return {
    ratio: Math.round(ratio * 100) / 100,
    aa: meetsAA(ratio, 'normal'),
    aaa: meetsAAA(ratio, 'normal'),
    aaLarge: meetsAA(ratio, 'large'),
    aaaLarge: meetsAAA(ratio, 'large'),
  };
}
