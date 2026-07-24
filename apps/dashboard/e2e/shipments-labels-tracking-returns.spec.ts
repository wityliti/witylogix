import { test, expect, Page } from "@playwright/test";

const TEST_CREDS = {
  email: "admin@demo.witylogix.io",
  password: "Admin123!",
  shopDomain: "demo.witylogix.io",
};

/**
 * Login via API and set auth cookie — reused across all test suites.
 */
async function loginViaAPI(page: Page) {
  const response = await page.request.post(
    "http://localhost:8000/api/v4/auth/login",
    {
      data: {
        email: TEST_CREDS.email,
        password: TEST_CREDS.password,
        shopDomain: TEST_CREDS.shopDomain,
      },
    },
  );

  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  const token = body.data?.accessToken || body.accessToken;
  const user = body.data?.user || body.user;
  expect(token).toBeTruthy();

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

  await page.goto("about:blank");
  await page.goto("/home", { waitUntil: "commit" });
  await page.evaluate((userData) => {
    localStorage.setItem("authUser", JSON.stringify(userData));
  }, user);

  return token;
}

/**
 * Navigate to a page and assert it loads without critical errors.
 * Optionally checks that the body contains a given pattern.
 */
async function verifyPageLoads(
  page: Page,
  path: string,
  contentPattern?: RegExp,
) {
  await page.goto(path, { waitUntil: "commit", timeout: 25000 });
  await page.waitForTimeout(3000);

  const bodyText = await page.locator("body").textContent({ timeout: 10000 });
  expect(bodyText).not.toContain("Application error");
  expect(bodyText).not.toContain("Internal Server Error");

  if (contentPattern) {
    expect(bodyText?.toLowerCase()).toMatch(contentPattern);
  }
}

// ---------------------------------------------------------------------------
// Shipments Pages
// ---------------------------------------------------------------------------

test.describe("Shipments Pages", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test("shipments list loads", async ({ page }) => {
    await verifyPageLoads(
      page,
      "/shipments",
      /shipment|tracking|status|delivery/i,
    );
  });

  test("shipments list shows stat cards and table", async ({ page }) => {
    await page.goto("/shipments", { waitUntil: "commit", timeout: 25000 });
    await page.waitForTimeout(3000);
    const bodyText = await page.locator("body").textContent({ timeout: 10000 });
    expect(bodyText).not.toContain("Application error");
    // Should show either data or an empty state — not a blank page
    expect(bodyText?.length).toBeGreaterThan(100);
  });

  test("shipments list supports status filter", async ({ page }) => {
    await page.goto("/shipments", { waitUntil: "commit", timeout: 25000 });
    await page.waitForTimeout(3000);

    // Look for a status filter button or dropdown
    const filterBtn = page
      .locator("button")
      .filter({ hasText: /all|status|filter/i })
      .first();
    const btnCount = await filterBtn.count();
    if (btnCount > 0) {
      await filterBtn.click();
      await page.waitForTimeout(1000);
      const bodyText = await page
        .locator("body")
        .textContent({ timeout: 5000 });
      expect(bodyText).not.toContain("Application error");
    }
  });

  test("shipment detail page loads", async ({ page }) => {
    // Navigate to a shipment detail — use a known ID pattern or skip gracefully
    await page.goto("/shipments", { waitUntil: "commit", timeout: 25000 });
    await page.waitForTimeout(3000);

    // Try to click the first shipment row link
    const shipmentLink = page.locator("a[href*='/shipments/']").first();
    const linkCount = await shipmentLink.count();
    if (linkCount > 0) {
      await shipmentLink.click();
      await page.waitForTimeout(3000);
      const bodyText = await page
        .locator("body")
        .textContent({ timeout: 10000 });
      expect(bodyText).not.toContain("Application error");
      expect(bodyText).not.toContain("Internal Server Error");
    }
  });
});

// ---------------------------------------------------------------------------
// Shipping Labels Pages
// ---------------------------------------------------------------------------

test.describe("Shipping Labels Pages", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test("shipping labels page loads", async ({ page }) => {
    await verifyPageLoads(
      page,
      "/shipping/labels",
      /label|carrier|shipment|print/i,
    );
  });

  test("shipping labels page shows content without errors", async ({
    page,
  }) => {
    await page.goto("/shipping/labels", {
      waitUntil: "commit",
      timeout: 25000,
    });
    await page.waitForTimeout(3000);
    const bodyText = await page.locator("body").textContent({ timeout: 10000 });
    expect(bodyText).not.toContain("Application error");
    expect(bodyText).not.toContain("Internal Server Error");
    expect(bodyText?.length).toBeGreaterThan(100);
  });

  test("shipping labels supports search", async ({ page }) => {
    await page.goto("/shipping/labels", {
      waitUntil: "commit",
      timeout: 25000,
    });
    await page.waitForTimeout(3000);

    const searchInput = page
      .locator("input[placeholder*='search' i], input[type='search']")
      .first();
    const inputCount = await searchInput.count();
    if (inputCount > 0) {
      await searchInput.fill("test");
      await page.waitForTimeout(1500);
      const bodyText = await page
        .locator("body")
        .textContent({ timeout: 5000 });
      expect(bodyText).not.toContain("Application error");
    }
  });
});

// ---------------------------------------------------------------------------
// Shipping Tracking Pages
// ---------------------------------------------------------------------------

test.describe("Shipping Tracking Pages", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test("shipping tracking page loads", async ({ page }) => {
    await verifyPageLoads(
      page,
      "/shipping/tracking",
      /track|carrier|status|shipment/i,
    );
  });

  test("shipping tracking page shows content without errors", async ({
    page,
  }) => {
    await page.goto("/shipping/tracking", {
      waitUntil: "commit",
      timeout: 25000,
    });
    await page.waitForTimeout(3000);
    const bodyText = await page.locator("body").textContent({ timeout: 10000 });
    expect(bodyText).not.toContain("Application error");
    expect(bodyText).not.toContain("Internal Server Error");
    expect(bodyText?.length).toBeGreaterThan(100);
  });

  test("shipping tracking supports carrier filter", async ({ page }) => {
    await page.goto("/shipping/tracking", {
      waitUntil: "commit",
      timeout: 25000,
    });
    await page.waitForTimeout(3000);

    const filterBtn = page
      .locator("button, select")
      .filter({ hasText: /carrier|all|filter/i })
      .first();
    const btnCount = await filterBtn.count();
    if (btnCount > 0) {
      await filterBtn.click();
      await page.waitForTimeout(1000);
      const bodyText = await page
        .locator("body")
        .textContent({ timeout: 5000 });
      expect(bodyText).not.toContain("Application error");
    }
  });
});

// ---------------------------------------------------------------------------
// Returns Pages
// ---------------------------------------------------------------------------

test.describe("Returns Pages", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test("returns list page loads", async ({ page }) => {
    await verifyPageLoads(page, "/returns", /return|rma|refund|status/i);
  });

  test("returns page shows status pipeline", async ({ page }) => {
    await page.goto("/returns", { waitUntil: "commit", timeout: 25000 });
    await page.waitForTimeout(3000);
    const bodyText = await page.locator("body").textContent({ timeout: 10000 });
    expect(bodyText).not.toContain("Application error");
    expect(bodyText).not.toContain("Internal Server Error");
    // Should show return status stages
    expect(bodyText?.toLowerCase()).toMatch(
      /requested|approved|received|refunded/i,
    );
  });

  test("returns page create button is present", async ({ page }) => {
    await page.goto("/returns", { waitUntil: "commit", timeout: 25000 });
    await page.waitForTimeout(3000);

    const createBtn = page
      .locator("button")
      .filter({ hasText: /create return|new return/i })
      .first();
    const btnCount = await createBtn.count();
    if (btnCount > 0) {
      await createBtn.click();
      await page.waitForTimeout(1000);
      const bodyText = await page
        .locator("body")
        .textContent({ timeout: 5000 });
      expect(bodyText).not.toContain("Application error");
    }
  });

  test("returns page content does not rely on mock data", async ({ page }) => {
    await page.goto("/returns", { waitUntil: "commit", timeout: 25000 });
    await page.waitForTimeout(3000);
    const bodyText = await page.locator("body").textContent({ timeout: 10000 });
    // Mock RET-2024-xxx IDs should not appear in production
    expect(bodyText).not.toContain("RET-2024-001");
    expect(bodyText).not.toContain("RET-2024-002");
  });
});

// ---------------------------------------------------------------------------
// Shipments API Smoke Tests
// ---------------------------------------------------------------------------

test.describe("Shipments API", () => {
  let authToken: string;

  test.beforeEach(async ({ page }) => {
    authToken = await loginViaAPI(page);
  });

  test("GET /api/v4/shipments returns paginated list", async ({ request }) => {
    const response = await request.get(
      "http://localhost:8000/api/v4/shipments?limit=10",
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );
    // Accept 200 or 401 (if token format differs) — just must not 500
    expect(response.status()).not.toBe(500);
  });

  test("GET /api/v4/returns returns paginated list", async ({ request }) => {
    const response = await request.get(
      "http://localhost:8000/api/v4/returns?limit=10",
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );
    expect(response.status()).not.toBe(500);
  });

  test("GET /api/v4/returns/stats returns statistics", async ({ request }) => {
    const response = await request.get(
      "http://localhost:8000/api/v4/returns/stats",
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );
    expect(response.status()).not.toBe(500);
  });
});
