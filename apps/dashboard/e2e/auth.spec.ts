import { test, expect } from "@playwright/test";

const TEST_CREDS = {
  email: "admin@demo.witylogix.io",
  password: "Admin123!",
  shopDomain: "demo.witylogix.io",
};

test.describe("Authentication", () => {
  test("login page loads", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.locator('input[type="email"], input[id="email"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('input[type="password"], input[id="password"]')).toBeVisible();
  });

  test("login with valid credentials", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });

    // Wait for form to be interactive
    await expect(page.locator('input[id="email"]')).toBeVisible({ timeout: 15000 });

    // Fill login form
    await page.locator('input[id="email"]').fill(TEST_CREDS.email);
    await page.locator('input[id="password"]').fill(TEST_CREDS.password);

    // Submit
    await page.locator('button[type="submit"]').click();

    // Should redirect to dashboard (/, /home, or wherever)
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

    // Should show dashboard content (sidebar, user name, etc.)
    await expect(page.locator("body")).toContainText(/dashboard|orders|overview|home|Alex/i, { timeout: 10000 });
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });

    await expect(page.locator('input[id="email"]')).toBeVisible({ timeout: 15000 });
    await page.locator('input[id="email"]').fill("bad@example.com");
    await page.locator('input[id="password"]').fill("wrongpassword123");
    await page.locator('button[type="submit"]').click();

    // Should show error message
    await expect(page.locator("text=/invalid|error|failed/i")).toBeVisible({ timeout: 10000 });
  });
});
