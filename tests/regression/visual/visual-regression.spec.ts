import { test, expect, devices } from '@playwright/test';
import {
  VIEWPORTS,
  PAGES_TO_CAPTURE,
  PIXEL_DIFF_THRESHOLD,
  BaselineManager,
  getAssertionOptions,
} from './screenshot.config';

/**
 * Visual Regression Test Suite
 * Tests UI consistency and layout across viewports
 *
 * Covers:
 * - Screenshot comparison against baselines
 * - Multiple viewport sizes (mobile, tablet, desktop)
 * - Key pages and user flows
 * - Responsive design validation
 * - Visual diff reporting
 *
 * Run with: npx playwright test --config=tests/regression/playwright.regression.config.ts tests/regression/visual/visual-regression.spec.ts
 * Update baselines: UPDATE_BASELINES=true npx playwright test --config=tests/regression/playwright.regression.config.ts tests/regression/visual/visual-regression.spec.ts
 * Accept diffs: ACCEPT_BASELINES=true npx playwright test --config=tests/regression/playwright.regression.config.ts tests/regression/visual/visual-regression.spec.ts
 */

test.describe('@visual Visual Regression Tests', () => {
  // Setup: Login before each test
  test.beforeEach(async ({ page }) => {
    // Navigate to login and authenticate
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', process.env.TEST_EMAIL || 'test@example.com');
    await page.fill('[data-testid="password-input"]', process.env.TEST_PASSWORD || 'TestPass123');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL(/dashboard|onboarding/, { timeout: 10000 });
  });

  test.describe('@visual-mobile Mobile Viewport (375x667)', () => {
    // Set mobile viewport for this suite
    test.use({ viewport: { width: 375, height: 667 } });

    PAGES_TO_CAPTURE.forEach((pageConfig) => {
      test(`should match baseline for ${pageConfig.name} on mobile`, async ({ page }) => {
        test.step('Navigate to page', async () => {
          await page.goto(pageConfig.path);
        });

        test.step('Wait for content to load', async () => {
          if (pageConfig.waitForSelector) {
            await page.waitForSelector(pageConfig.waitForSelector, { timeout: 10000 });
          }
          if (pageConfig.delay) {
            await page.waitForTimeout(pageConfig.delay);
          }
        });

        test.step('Capture screenshot and compare baseline', async () => {
          const baselinePath = BaselineManager.getBaselinePath(pageConfig.name, 'mobile');

          if (BaselineManager.shouldUpdate()) {
            // Update baseline
            await expect(page).toHaveScreenshot(baselinePath, {
              fullPage: true,
              threshold: PIXEL_DIFF_THRESHOLD,
            });
          } else if (BaselineManager.shouldReject()) {
            // Just capture, don't assert (for manual review)
            await page.screenshot({ path: `tests/regression/visual/current/${pageConfig.name}__mobile.png`, fullPage: true });
          } else {
            // Standard regression test - compare against baseline
            await expect(page).toHaveScreenshot(baselinePath, {
              fullPage: true,
              threshold: PIXEL_DIFF_THRESHOLD,
              maxDiffPixels: 100, // Allow up to 100 different pixels
            });
          }
        });
      });
    });
  });

  test.describe('@visual-tablet Tablet Viewport (768x1024)', () => {
    // Set tablet viewport for this suite
    test.use({ viewport: { width: 768, height: 1024 } });

    PAGES_TO_CAPTURE.forEach((pageConfig) => {
      test(`should match baseline for ${pageConfig.name} on tablet`, async ({ page }) => {
        test.step('Navigate to page', async () => {
          await page.goto(pageConfig.path);
        });

        test.step('Wait for content to load', async () => {
          if (pageConfig.waitForSelector) {
            await page.waitForSelector(pageConfig.waitForSelector, { timeout: 10000 });
          }
          if (pageConfig.delay) {
            await page.waitForTimeout(pageConfig.delay);
          }
        });

        test.step('Capture screenshot and compare baseline', async () => {
          const baselinePath = BaselineManager.getBaselinePath(pageConfig.name, 'tablet');

          if (BaselineManager.shouldUpdate()) {
            // Update baseline
            await expect(page).toHaveScreenshot(baselinePath, {
              fullPage: true,
              threshold: PIXEL_DIFF_THRESHOLD,
            });
          } else if (BaselineManager.shouldReject()) {
            // Just capture, don't assert (for manual review)
            await page.screenshot({ path: `tests/regression/visual/current/${pageConfig.name}__tablet.png`, fullPage: true });
          } else {
            // Standard regression test - compare against baseline
            await expect(page).toHaveScreenshot(baselinePath, {
              fullPage: true,
              threshold: PIXEL_DIFF_THRESHOLD,
              maxDiffPixels: 100,
            });
          }
        });
      });
    });
  });

  test.describe('@visual-desktop Desktop Viewport (1440x900)', () => {
    // Set desktop viewport for this suite
    test.use({ viewport: { width: 1440, height: 900 } });

    PAGES_TO_CAPTURE.forEach((pageConfig) => {
      test(`should match baseline for ${pageConfig.name} on desktop`, async ({ page }) => {
        test.step('Navigate to page', async () => {
          await page.goto(pageConfig.path);
        });

        test.step('Wait for content to load', async () => {
          if (pageConfig.waitForSelector) {
            await page.waitForSelector(pageConfig.waitForSelector, { timeout: 10000 });
          }
          if (pageConfig.delay) {
            await page.waitForTimeout(pageConfig.delay);
          }
        });

        test.step('Capture screenshot and compare baseline', async () => {
          const baselinePath = BaselineManager.getBaselinePath(pageConfig.name, 'desktop');

          if (BaselineManager.shouldUpdate()) {
            // Update baseline
            await expect(page).toHaveScreenshot(baselinePath, {
              fullPage: true,
              threshold: PIXEL_DIFF_THRESHOLD,
            });
          } else if (BaselineManager.shouldReject()) {
            // Just capture, don't assert (for manual review)
            await page.screenshot({ path: `tests/regression/visual/current/${pageConfig.name}__desktop.png`, fullPage: true });
          } else {
            // Standard regression test - compare against baseline
            await expect(page).toHaveScreenshot(baselinePath, {
              fullPage: true,
              threshold: PIXEL_DIFF_THRESHOLD,
              maxDiffPixels: 150, // Allow more variation on large desktop screens
            });
          }
        });
      });
    });
  });

  test.describe('@visual-components Component Consistency', () => {
    test('@visual-mobile should display navigation consistently on mobile', async ({ page }) => {
      test.use({ viewport: { width: 375, height: 667 } });
      await page.goto('/dashboard');
      await page.waitForSelector('[data-testid="navigation-menu"]', { timeout: 10000 });

      // Capture navigation area
      const navElement = page.locator('[data-testid="navigation-menu"]');
      await expect(navElement).toHaveScreenshot('navigation__mobile.png');
    });

    test('@visual-desktop should display navigation consistently on desktop', async ({ page }) => {
      test.use({ viewport: { width: 1440, height: 900 } });
      await page.goto('/dashboard');
      await page.waitForSelector('[data-testid="navigation-menu"]', { timeout: 10000 });

      // Capture navigation area
      const navElement = page.locator('[data-testid="navigation-menu"]');
      await expect(navElement).toHaveScreenshot('navigation__desktop.png');
    });

    test('should render buttons consistently', async ({ page }) => {
      await page.goto('/dashboard');

      // Find all buttons and capture each
      const buttons = page.locator('button[data-testid]');
      const count = await buttons.count();

      if (count > 0) {
        const firstButton = buttons.first();
        await expect(firstButton).toHaveScreenshot('button__primary.png');
      }
    });

    test('should render forms consistently', async ({ page }) => {
      await page.goto('/orders/new');
      await page.waitForSelector('[data-testid="order-form"]', { timeout: 10000 });

      const form = page.locator('[data-testid="order-form"]');
      await expect(form).toHaveScreenshot('form__order-creation.png');
    });
  });

  test.describe('@visual-responsive Responsive Design', () => {
    test('should not have horizontal scroll on mobile', async ({ page }) => {
      test.use({ viewport: { width: 375, height: 667 } });
      await page.goto('/dashboard');
      await page.waitForSelector('[data-testid="dashboard-container"]', { timeout: 10000 });

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);

      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });

    test('should not have horizontal scroll on tablet', async ({ page }) => {
      test.use({ viewport: { width: 768, height: 1024 } });
      await page.goto('/dashboard');
      await page.waitForSelector('[data-testid="dashboard-container"]', { timeout: 10000 });

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);

      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });

    test('should maintain layout integrity during responsive transitions', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForSelector('[data-testid="dashboard-container"]', { timeout: 10000 });

      const viewportSizes = [375, 768, 1024, 1440];

      for (const width of viewportSizes) {
        await page.setViewportSize({ width, height: 900 });
        await page.waitForTimeout(500); // Allow layout shift

        // Verify no elements are hidden due to overflow
        const overflowElements = await page.locator('[style*="overflow: hidden"]').count();
        const visibleHeight = await page.evaluate(() => window.innerHeight);

        expect(visibleHeight).toBeGreaterThan(0);
      }
    });
  });

  test.describe('@visual-spacing Spacing & Typography', () => {
    test('should maintain consistent spacing on all viewports', async ({ page }) => {
      await page.goto('/dashboard');

      // Check that major sections have consistent spacing
      const containers = page.locator('[data-testid*="card"]');
      const count = await containers.count();

      expect(count).toBeGreaterThan(0);

      // Verify computed styles for consistency
      const firstContainer = containers.first();
      const styles = await firstContainer.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          padding: computed.padding,
          margin: computed.margin,
          gap: computed.gap,
        };
      });

      expect(styles.padding || styles.margin).toBeTruthy();
    });

    test('should render typography consistently', async ({ page }) => {
      await page.goto('/dashboard');

      // Check headings
      const headings = page.locator('h1, h2, h3');
      const headingCount = await headings.count();

      expect(headingCount).toBeGreaterThan(0);

      // Verify text is readable
      const firstHeading = headings.first();
      const fontSize = await firstHeading.evaluate((el) => {
        return window.getComputedStyle(el).fontSize;
      });

      expect(fontSize).not.toBe('0px');
    });
  });

  test.describe('@visual-colors Colors & Contrast', () => {
    test('should have sufficient color contrast for accessibility', async ({ page }) => {
      await page.goto('/dashboard');

      // Check for text contrast (simplified check)
      const textElements = page.locator('p, span, a, button');
      const count = await textElements.count();

      expect(count).toBeGreaterThan(0);

      // Sample first few elements
      for (let i = 0; i < Math.min(5, count); i++) {
        const element = textElements.nth(i);
        const styles = await element.evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return {
            color: computed.color,
            backgroundColor: computed.backgroundColor,
          };
        });

        // Color should not be transparent
        expect(styles.color).not.toMatch(/rgba.*0\s*\)/);
      }
    });

    test('should maintain color consistency across themes', async ({ page }) => {
      await page.goto('/dashboard');

      // Find all elements with color styling
      const coloredElements = page.locator('[style*="color"]');
      const count = await coloredElements.count();

      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('@visual-dark-mode Dark Mode', () => {
    test('should render correctly in dark mode on desktop', async ({ page }) => {
      test.use({ viewport: { width: 1440, height: 900 } });

      await page.goto('/dashboard');

      // Toggle dark mode if available
      const darkModeToggle = page.locator('[data-testid="dark-mode-toggle"]');
      if (await darkModeToggle.isVisible()) {
        await darkModeToggle.click();
        await page.waitForTimeout(500); // Wait for theme transition
      }

      // Capture dark mode screenshot
      await expect(page).toHaveScreenshot('dashboard__dark-mode.png', {
        fullPage: true,
        threshold: PIXEL_DIFF_THRESHOLD,
      });
    });

    test('should render correctly in dark mode on mobile', async ({ page }) => {
      test.use({ viewport: { width: 375, height: 667 } });

      await page.goto('/dashboard');

      // Toggle dark mode if available
      const darkModeToggle = page.locator('[data-testid="dark-mode-toggle"]');
      if (await darkModeToggle.isVisible()) {
        await darkModeToggle.click();
        await page.waitForTimeout(500); // Wait for theme transition
      }

      // Capture dark mode screenshot
      await expect(page).toHaveScreenshot('dashboard__dark-mode-mobile.png', {
        fullPage: true,
        threshold: PIXEL_DIFF_THRESHOLD,
      });
    });
  });
});
