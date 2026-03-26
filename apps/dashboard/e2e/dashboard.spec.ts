import { test, expect, Page } from "@playwright/test";

const TEST_CREDS = {
  email: "admin@demo.witylogix.io",
  password: "Admin123!",
};

/**
 * Helper: login via the auth API directly and set cookies/localStorage
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
  const user = body.data?.user || body.user;
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

  // Navigate to a static asset page to set localStorage (avoids redirect loops)
  // We use about:blank first then a known page
  await page.goto("about:blank");

  // Now navigate to the home page — the cookie is set so middleware will allow it
  await page.goto("/home", { waitUntil: "commit" });

  await page.evaluate((userData) => {
    localStorage.setItem("authUser", JSON.stringify(userData));
  }, user);

  return token;
}

/**
 * Helper: navigate to a page and verify it loads without critical errors.
 */
async function verifyPageLoads(page: Page, path: string, contentPattern?: RegExp) {
  // Use 'commit' to handle redirects gracefully
  const resp = await page.goto(path, { waitUntil: "commit", timeout: 25000 });

  // Wait for page content to render
  await page.waitForTimeout(3000);

  // Should not show application error
  const bodyText = await page.locator("body").textContent({ timeout: 10000 });
  expect(bodyText).not.toContain("Application error");
  expect(bodyText).not.toContain("Internal Server Error");

  if (contentPattern) {
    expect(bodyText?.toLowerCase()).toMatch(contentPattern);
  }
}

test.describe("Dashboard Pages", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test("dashboard home loads with data", async ({ page }) => {
    // Already on /home from loginViaAPI
    await page.waitForTimeout(3000);

    const body = await page.locator("body").textContent();
    expect(body).toBeTruthy();

    // Check that key navigation items are present
    const hasNav = await page.locator("text=/Orders|Drivers|Routes|Settings/i").count();
    expect(hasNav).toBeGreaterThan(0);
  });

  test("orders page loads", async ({ page }) => {
    await verifyPageLoads(page, "/orders", /order|delivery|shipment/);
  });

  test("drivers page loads", async ({ page }) => {
    await verifyPageLoads(page, "/drivers", /driver|fleet|vehicle/);
  });

  test("routes page loads", async ({ page }) => {
    await verifyPageLoads(page, "/routes");
  });

  test("settings page loads", async ({ page }) => {
    await verifyPageLoads(page, "/settings/general", /setting|general|configuration|preference/);
  });

  test("zones page loads", async ({ page }) => {
    await verifyPageLoads(page, "/zones");
  });

  test("analytics page loads", async ({ page }) => {
    await verifyPageLoads(page, "/analytics");
  });

  test("customers page loads", async ({ page }) => {
    await verifyPageLoads(page, "/customers");
  });
});
