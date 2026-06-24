import { test, expect } from "../fixtures/auth";
import type { Page } from "@playwright/test";

/**
 * Tier 3 — data sanity checks.
 *
 * Instead of counting DOM rows (fragile across card/table layouts), we
 * assert that the seeded records are actually RENDERED in the DOM by
 * looking for their known text values (driver names, customer emails,
 * etc.). If the page says "No data" or crashes silently, these tests catch
 * it.
 *
 * Seed data (packages/db/prisma/seed.ts):
 *   Drivers:   James Wilson, Maria Garcia, David Kim, Lisa Thompson, Ahmed Hassan
 *   Customers: nina@freshbox.io + 7 others (8 total)
 *   Orders:    25 synthetic orders across seed customers
 *   Zones:     3 delivery zones
 */

type SanityCase = {
  name: string;
  path: string;
  expected: string[];
  // If true, ALL strings must appear. If false, AT LEAST ONE.
  requireAll?: boolean;
};

const CASES: SanityCase[] = [
  {
    name: "drivers",
    path: "/drivers",
    // Seed driver names — at least one must render.
    expected: ["James Wilson", "Maria Garcia", "David Kim", "Lisa Thompson", "Ahmed Hassan"],
  },
  {
    name: "customers",
    // Customers page shows name (joined first+last) or fallback to email.
    path: "/customers",
    expected: ["nina@", "@freshbox", "@"],
  },
  {
    name: "orders",
    path: "/orders",
    // Orders have synthetic customer names from the seed pool.
    expected: ["Kevin Patel", "Emily Davis", "Amanda Chen", "John Smith", "Rachel Green"],
  },
];

async function collectVisibleText(page: Page): Promise<string> {
  // Wait for network to settle then pull the full body text.
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  return (await page.locator("body").textContent()) ?? "";
}

test.describe("Tier 3 — seed data renders in the UI", () => {
  for (const c of CASES) {
    test(`${c.name} page renders seeded records`, async ({ authedPage }, testInfo) => {
      const page = authedPage;
      await page.goto(c.path, { waitUntil: "domcontentloaded" });
      const text = await collectVisibleText(page);

      const hits = c.expected.filter((needle) => text.includes(needle));
      testInfo.annotations.push({
        type: "sanity-hits",
        description: `${c.name}: matched ${hits.length}/${c.expected.length} — [${hits.join(", ")}]`,
      });

      await testInfo.attach(`${c.name}-rendered.png`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });

      if (c.requireAll) {
        for (const needle of c.expected) {
          expect(text, `${c.name} page missing "${needle}"`).toContain(needle);
        }
      } else {
        expect(
          hits.length,
          `${c.name} page did not render any of: ${c.expected.join(", ")}`,
        ).toBeGreaterThan(0);
      }
    });
  }
});
