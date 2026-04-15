import { test, expect } from "../fixtures/auth";
import type { Page } from "@playwright/test";

/**
 * Tier 1 smoke suite — the 10 highest-value dashboard routes.
 *
 * Each test:
 *   1. Navigates to the page (using the shared authedPage fixture)
 *   2. Asserts the page is not showing an application error
 *   3. Counts all visible, enabled buttons on the page — records the number
 *      so regressions shrink visible actions
 *   4. Takes a full-page screenshot for manual review / report attachments
 *
 * This is observability, not behavior testing. Tier 2 will click buttons.
 */

type RouteSpec = {
  name: string;
  path: string;
  // Soft check — at least one of these terms should appear in the page text.
  expectText?: RegExp;
  // Minimum number of enabled buttons we expect to see. 0 = no assertion.
  minButtons?: number;
};

const ROUTES: RouteSpec[] = [
  // Core list pages
  { name: "home", path: "/home", expectText: /orders|drivers|routes|home/i, minButtons: 1 },
  { name: "orders", path: "/orders", expectText: /order|delivery|shipment/i, minButtons: 1 },
  { name: "drivers", path: "/drivers", expectText: /driver|fleet|vehicle/i, minButtons: 1 },
  { name: "customers", path: "/customers", expectText: /customer/i, minButtons: 1 },
  { name: "shipments", path: "/shipments", expectText: /shipment|tracking|label/i },
  { name: "zones", path: "/zones", expectText: /zone|area|region/i, minButtons: 1 },
  { name: "time-slots", path: "/time-slots", expectText: /time|slot|schedule/i },

  // Create pages (added in dead-button fix)
  { name: "drivers-create", path: "/drivers/create", expectText: /add driver|name|phone/i, minButtons: 2 },
  { name: "customers-create", path: "/customers/create", expectText: /add customer|email/i, minButtons: 2 },
  { name: "zones-create", path: "/zones/create", expectText: /create zone|base rate/i, minButtons: 2 },
  { name: "orders-create", path: "/orders/create", expectText: /order|customer|item/i },

  // Analytics / dashboards
  { name: "analytics", path: "/analytics", expectText: /analytic|dashboard|metric|chart/i },
  { name: "activity", path: "/activity" },
  { name: "tracking", path: "/tracking", expectText: /track|shipment|live/i },
  { name: "tracking-live", path: "/tracking/live", expectText: /live|map|driver/i },

  // Settings
  { name: "settings-general", path: "/settings/general", expectText: /setting|general|preference/i },
  { name: "settings-team", path: "/settings/team", expectText: /team|member|invite/i },
  { name: "settings-profile", path: "/settings/profile", expectText: /profile|name|email/i },
  { name: "settings-billing", path: "/settings/billing", expectText: /billing|plan|subscription/i },
  { name: "settings-carriers", path: "/settings/carriers", expectText: /carrier|shipping|rate/i },
];

async function countActionableButtons(page: Page): Promise<number> {
  // Anything that looks like an action: <button>, role=button, submit inputs,
  // and nav links styled as buttons. Filter to visible + enabled.
  const buttons = page.locator(
    'button:visible, [role="button"]:visible, input[type="submit"]:visible',
  );
  const count = await buttons.count();
  let actionable = 0;
  for (let i = 0; i < count; i++) {
    const btn = buttons.nth(i);
    const isEnabled = await btn.isEnabled().catch(() => false);
    if (isEnabled) actionable++;
  }
  return actionable;
}

async function assertNoAppError(page: Page) {
  const bodyText = (await page.locator("body").textContent({ timeout: 10000 })) ?? "";
  expect(bodyText, "page rendered Application error").not.toContain("Application error");
  expect(bodyText, "page rendered Internal Server Error").not.toContain("Internal Server Error");
  expect(bodyText, "page rendered 500").not.toMatch(/^500$/);
}

test.describe("Tier 1 smoke — dashboard routes", () => {
  for (const route of ROUTES) {
    test(`${route.name} loads and has actionable buttons`, async ({ authedPage }, testInfo) => {
      const page = authedPage;

      const response = await page.goto(route.path, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      // Not every route returns 200 (some are SSR with redirects); accept any 2xx/3xx.
      const status = response?.status() ?? 0;
      expect(status, `unexpected status ${status} for ${route.path}`).toBeLessThan(400);

      // Let client-side rendering settle.
      await page
        .waitForLoadState("networkidle", { timeout: 15000 })
        .catch(() => {
          // networkidle is best-effort; not fatal for long-lived websockets.
        });

      await assertNoAppError(page);

      if (route.expectText) {
        const bodyText = (await page.locator("body").textContent()) ?? "";
        expect(
          bodyText.toLowerCase(),
          `expected ${route.expectText} in page text`,
        ).toMatch(route.expectText);
      }

      const actionable = await countActionableButtons(page);
      testInfo.annotations.push({
        type: "button-count",
        description: `${route.name}: ${actionable} actionable buttons`,
      });

      if (route.minButtons !== undefined) {
        expect(
          actionable,
          `expected at least ${route.minButtons} enabled buttons on ${route.path}`,
        ).toBeGreaterThanOrEqual(route.minButtons);
      }

      await testInfo.attach(`${route.name}-full.png`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
    });
  }
});
