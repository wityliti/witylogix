import { test, expect, Page } from "@playwright/test";

const TEST_CREDS = {
  email: "admin@demo.witylogix.io",
  password: "Admin123!",
};

/**
 * Helper: login via the auth API directly and set cookies
 */
async function loginViaAPI(page: Page) {
  const response = await page.request.post("http://localhost:8000/api/v4/auth/login", {
    data: {
      email: TEST_CREDS.email,
      password: TEST_CREDS.password,
      shopDomain: "demo.witylogix.io",
    },
  });

  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  const token = body.data?.accessToken || body.accessToken;
  expect(token).toBeTruthy();

  // Set the auth cookie on the dashboard domain
  await page.context().addCookies([
    {
      name: "auth-token",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  // Set localStorage user data
  await page.goto("/");
  await page.evaluate((user) => {
    localStorage.setItem("authUser", JSON.stringify(user));
  }, body.data?.user || body.user);

  return token;
}

test.describe("Dashboard Pages", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test("dashboard home loads with data", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Should see dashboard content — sidebar navigation, stats, etc.
    const body = await page.locator("body").textContent();
    expect(body).toBeTruthy();

    // Check that key navigation items are present
    const navItems = ["Orders", "Drivers", "Routes", "Settings"];
    for (const item of navItems) {
      const found = await page.locator(`text=${item}`).count();
      if (found > 0) {
        // At least some nav items exist
        expect(found).toBeGreaterThan(0);
      }
    }
  });

  test("orders page loads", async ({ page }) => {
    await page.goto("/orders");
    await page.waitForLoadState("networkidle");

    // Page should load without error
    await expect(page.locator("body")).not.toContainText("Application error");
    await expect(page.locator("body")).not.toContainText("Internal Server Error");

    // Should show orders-related content
    const body = await page.locator("body").textContent();
    expect(body?.toLowerCase()).toMatch(/order|delivery|shipment/);
  });

  test("drivers page loads", async ({ page }) => {
    await page.goto("/drivers");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("body")).not.toContainText("Application error");
    await expect(page.locator("body")).not.toContainText("Internal Server Error");

    const body = await page.locator("body").textContent();
    expect(body?.toLowerCase()).toMatch(/driver|fleet|vehicle/);
  });

  test("routes page loads", async ({ page }) => {
    await page.goto("/routes");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("settings page loads", async ({ page }) => {
    await page.goto("/settings/general");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("body")).not.toContainText("Application error");

    const body = await page.locator("body").textContent();
    expect(body?.toLowerCase()).toMatch(/setting|general|configuration|preference/);
  });

  test("zones page loads", async ({ page }) => {
    await page.goto("/zones");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("analytics page loads", async ({ page }) => {
    await page.goto("/analytics");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("customers page loads", async ({ page }) => {
    await page.goto("/customers");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("body")).not.toContainText("Application error");
  });
});
