import { test, expect } from "@playwright/test";

const TEST_CREDS = {
  email: "admin@demo.witylogix.io",
  password: "Admin123!",
  shopDomain: "demo.witylogix.io",
};

test.describe("Authentication", () => {
  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/Witylogix|Login|Dashboard/i);
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
  });

  test("login with valid credentials", async ({ page }) => {
    await page.goto("/login");

    // Fill login form
    await page.locator('input[type="email"], input[name="email"]').fill(TEST_CREDS.email);
    await page.locator('input[type="password"], input[name="password"]').fill(TEST_CREDS.password);

    // Submit
    await page.locator('button[type="submit"]').click();

    // Should redirect to dashboard
    await page.waitForURL(/\/(dashboard|overview|$)/, { timeout: 15000 });

    // Should show dashboard content (sidebar, user name, etc.)
    await expect(page.locator("body")).toContainText(/dashboard|orders|overview|Alex/i);
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");

    await page.locator('input[type="email"], input[name="email"]').fill("bad@example.com");
    await page.locator('input[type="password"], input[name="password"]').fill("wrongpassword");
    await page.locator('button[type="submit"]').click();

    // Should show error message
    await expect(page.locator("text=/invalid|error|failed/i")).toBeVisible({ timeout: 10000 });
  });
});
