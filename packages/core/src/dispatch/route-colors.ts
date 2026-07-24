/**
 * Route color palette - 16 distinct colors for route visualization
 *
 * These colors are carefully chosen to be:
 * - Distinct and easily differentiable
 * - High contrast for visibility on maps
 * - Accessible for colorblind users
 * - Visually pleasing and professional
 */

export const ROUTE_COLORS = [
  "#FF6B6B", // Coral Red
  "#4ECDC4", // Teal
  "#45B7D1", // Sky Blue
  "#FFA07A", // Light Salmon
  "#98D8C8", // Mint
  "#F7DC6F", // Golden Yellow
  "#BB8FCE", // Purple
  "#85C1E2", // Powder Blue
  "#F8B739", // Orange
  "#52C9B5", // Turquoise
  "#FF8E72", // Salmon
  "#6C5CE7", // Purple Blue
  "#00B894", // Green
  "#FD79A8", // Pink
  "#FDCB6E", // Yellow Gold
  "#E17055", // Dark Orange
] as const;

export type RouteColorIndex = (typeof ROUTE_COLORS)[number];

/**
 * Get a color from the palette by index
 * @param index Index of the color (0-15)
 * @returns Hex color code
 */
export function getRouteColor(index: number): string {
  return ROUTE_COLORS[index % ROUTE_COLORS.length];
}

/**
 * Get all available colors
 * @returns Array of hex color codes
 */
export function getAllRouteColors(): string[] {
  return [...ROUTE_COLORS];
}

/**
 * Get a color index based on a string identifier (route ID, driver ID)
 * @param identifier String identifier
 * @returns Color index (0-15)
 */
export function getColorIndexForIdentifier(identifier: string): number {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    const char = identifier.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) % ROUTE_COLORS.length;
}

/**
 * Get a color for an identifier (deterministic based on string)
 * @param identifier String identifier
 * @returns Hex color code
 */
export function getRouteColorForIdentifier(identifier: string): string {
  const index = getColorIndexForIdentifier(identifier);
  return ROUTE_COLORS[index];
}

/**
 * Get lighter shade of a color (for hover/active states)
 * @param hexColor Hex color code
 * @param percent Percentage to lighten (0-100)
 * @returns Lighter hex color
 */
export function lightenColor(hexColor: string, percent: number): string {
  const num = parseInt(hexColor.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
  const B = Math.min(255, (num & 0x0000ff) + amt);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

/**
 * Get darker shade of a color (for borders/shadows)
 * @param hexColor Hex color code
 * @param percent Percentage to darken (0-100)
 * @returns Darker hex color
 */
export function darkenColor(hexColor: string, percent: number): string {
  const num = parseInt(hexColor.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, (num >> 16) - amt);
  const G = Math.max(0, ((num >> 8) & 0x00ff) - amt);
  const B = Math.max(0, (num & 0x0000ff) - amt);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

/**
 * Convert hex color to RGB
 * @param hexColor Hex color code
 * @returns Object with r, g, b values (0-255)
 */
export function hexToRgb(hexColor: string): {
  r: number;
  g: number;
  b: number;
} {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexColor);
  if (!result) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Get RGB string for CSS
 * @param hexColor Hex color code
 * @returns RGB string for CSS (e.g., "rgb(255, 107, 107)")
 */
export function hexToRgbString(hexColor: string): string {
  const { r, g, b } = hexToRgb(hexColor);
  return `rgb(${r}, ${g}, ${b})`;
}
