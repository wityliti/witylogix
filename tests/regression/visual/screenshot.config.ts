/**
 * Visual Regression Screenshot Configuration
 * Defines screenshot comparison settings, viewports, and baseline management
 */

export interface ViewportConfig {
  name: string;
  width: number;
  height: number;
}

export interface PageConfig {
  path: string;
  name: string;
  waitForSelector?: string;
  delay?: number;
}

export interface ScreenshotConfig {
  pixelDiffThreshold: number;
  viewports: ViewportConfig[];
  pages: PageConfig[];
  baselineDir: string;
  updateBaselines: boolean;
  acceptBaselines: boolean;
  rejectBaselines: boolean;
}

/**
 * Pixel difference threshold for visual regression (0.1% = very strict)
 * 0.1% means 99.9% pixel match required
 */
export const PIXEL_DIFF_THRESHOLD = 0.1;

/**
 * Viewport configurations for responsive design testing
 */
export const VIEWPORTS: ViewportConfig[] = [
  {
    name: "mobile",
    width: 375,
    height: 667,
  },
  {
    name: "tablet",
    width: 768,
    height: 1024,
  },
  {
    name: "desktop",
    width: 1440,
    height: 900,
  },
];

/**
 * Pages to capture for visual regression testing
 * Each page includes navigation path and optional selectors to wait for before capture
 */
export const PAGES_TO_CAPTURE: PageConfig[] = [
  {
    path: "/dashboard",
    name: "dashboard-home",
    waitForSelector: '[data-testid="dashboard-container"]',
    delay: 1000, // Wait 1s for animations
  },
  {
    path: "/orders",
    name: "orders-list",
    waitForSelector: '[data-testid="orders-table"]',
    delay: 500,
  },
  {
    path: "/orders/1",
    name: "order-detail",
    waitForSelector: '[data-testid="order-detail-container"]',
    delay: 500,
  },
  {
    path: "/drivers",
    name: "drivers-list",
    waitForSelector: '[data-testid="drivers-table"]',
    delay: 500,
  },
  {
    path: "/deliveries/map",
    name: "delivery-map",
    waitForSelector: '[data-testid="map-container"]',
    delay: 2000, // Maps need more time to render
  },
  {
    path: "/settings",
    name: "settings-page",
    waitForSelector: '[data-testid="settings-form"]',
    delay: 500,
  },
];

/**
 * Screenshot configuration builder
 */
export function getScreenshotConfig(
  options?: Partial<ScreenshotConfig>,
): ScreenshotConfig {
  return {
    pixelDiffThreshold: PIXEL_DIFF_THRESHOLD,
    viewports: VIEWPORTS,
    pages: PAGES_TO_CAPTURE,
    baselineDir: "tests/regression/visual/baselines",
    updateBaselines: process.env.UPDATE_BASELINES === "true",
    acceptBaselines: process.env.ACCEPT_BASELINES === "true",
    rejectBaselines: process.env.REJECT_BASELINES === "true",
    ...options,
  };
}

/**
 * Baseline management functions
 */
export const BaselineManager = {
  /**
   * Get baseline image path for a page and viewport
   */
  getBaselinePath(pageName: string, viewportName: string): string {
    const config = getScreenshotConfig();
    return `${config.baselineDir}/${pageName}__${viewportName}.png`;
  },

  /**
   * Get current screenshot path for a page and viewport
   */
  getCurrentPath(pageName: string, viewportName: string): string {
    return `tests/regression/visual/current/${pageName}__${viewportName}.png`;
  },

  /**
   * Get diff image path for a page and viewport
   */
  getDiffPath(pageName: string, viewportName: string): string {
    return `tests/regression/visual/diffs/${pageName}__${viewportName}.png`;
  },

  /**
   * Should update baseline for this test run
   */
  shouldUpdate(): boolean {
    return getScreenshotConfig().updateBaselines;
  },

  /**
   * Should accept baseline diffs for this test run
   */
  shouldAccept(): boolean {
    return getScreenshotConfig().acceptBaselines;
  },

  /**
   * Should reject baseline diffs for this test run
   */
  shouldReject(): boolean {
    return getScreenshotConfig().rejectBaselines;
  },
};

/**
 * Assertion options for screenshot comparison
 */
export interface AssertionOptions {
  threshold?: number;
  ignoreDynamicContent?: boolean;
  mask?: Array<{ x: number; y: number; width: number; height: number }>;
}

/**
 * Get assertion options for screenshot comparison
 */
export function getAssertionOptions(
  options?: Partial<AssertionOptions>,
): AssertionOptions {
  return {
    threshold: PIXEL_DIFF_THRESHOLD,
    ignoreDynamicContent: false,
    mask: [], // Mask dynamic areas like timestamps, dates, etc.
    ...options,
  };
}

/**
 * Common masks for dynamic content areas
 */
export const DYNAMIC_MASKS = {
  timestamp: {
    x: 0,
    y: 0,
    width: 200,
    height: 30,
  },
  userMenu: {
    x: 1400,
    y: 0,
    width: 40,
    height: 40,
  },
};

/**
 * Viewport selectors for snapshot testing by viewport
 */
export const getViewportTag = (width: number, height: number): string => {
  if (width <= 375) return "@visual-mobile";
  if (width <= 768) return "@visual-tablet";
  return "@visual-desktop";
};
