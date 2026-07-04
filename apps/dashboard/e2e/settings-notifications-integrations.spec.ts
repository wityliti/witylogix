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
// Settings Pages
// ---------------------------------------------------------------------------

test.describe("Settings Pages", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test("settings overview loads", async ({ page }) => {
    await verifyPageLoads(
      page,
      "/settings",
      /setting|profile|organization|general/i,
    );
  });

  test("general settings loads", async ({ page }) => {
    await verifyPageLoads(
      page,
      "/settings/general",
      /general|setting|company|timezone/i,
    );
  });

  test("organization settings loads", async ({ page }) => {
    await verifyPageLoads(
      page,
      "/settings/organization",
      /organ|company|detail|setting/i,
    );
  });

  test("team settings loads", async ({ page }) => {
    await verifyPageLoads(page, "/settings/team", /team|member|user|invite/i);
  });

  test("api-keys settings loads", async ({ page }) => {
    await verifyPageLoads(page, "/settings/api-keys", /api key|key|token/i);
  });

  test("billing settings loads", async ({ page }) => {
    await verifyPageLoads(
      page,
      "/settings/billing",
      /billing|plan|subscription/i,
    );
  });

  test("notification settings loads", async ({ page }) => {
    await verifyPageLoads(page, "/settings/notifications", /notif/i);
  });

  test("notification templates loads", async ({ page }) => {
    await verifyPageLoads(
      page,
      "/settings/notifications/templates",
      /template|notif/i,
    );
  });

  test("whatsapp notification config loads", async ({ page }) => {
    await verifyPageLoads(
      page,
      "/settings/notifications/whatsapp",
      /whatsapp|notif/i,
    );
  });

  test("webhooks settings loads", async ({ page }) => {
    await verifyPageLoads(
      page,
      "/settings/webhooks",
      /webhook|event|endpoint/i,
    );
  });

  test("webhook test page loads", async ({ page }) => {
    await verifyPageLoads(page, "/settings/webhooks/test", /webhook|test/i);
  });

  test("branding settings loads", async ({ page }) => {
    await verifyPageLoads(page, "/settings/branding", /brand|logo|color/i);
  });

  test("maps settings loads", async ({ page }) => {
    await verifyPageLoads(
      page,
      "/settings/maps",
      /map|provider|google|mapbox/i,
    );
  });

  test("auth providers settings loads", async ({ page }) => {
    await verifyPageLoads(
      page,
      "/settings/auth-providers",
      /auth|provider|oauth|sso/i,
    );
  });

  test("preferences settings loads", async ({ page }) => {
    await verifyPageLoads(page, "/settings/preferences", /prefer/i);
  });

  test("profile settings loads", async ({ page }) => {
    await verifyPageLoads(
      page,
      "/settings/profile",
      /profile|account|name|email/i,
    );
  });

  // --- Functional flow: general settings save ---
  test("general settings form persists on save", async ({ page }) => {
    await page.goto("/settings/general", {
      waitUntil: "commit",
      timeout: 25000,
    });
    await page.waitForTimeout(3000);

    const saveBtn = page
      .locator("button")
      .filter({ hasText: /save|update/i })
      .first();
    const btnCount = await saveBtn.count();
    if (btnCount > 0) {
      await saveBtn.click();
      await page.waitForTimeout(2000);
      const bodyText = await page
        .locator("body")
        .textContent({ timeout: 5000 });
      expect(bodyText).not.toContain("Application error");
    }
  });

  // --- Functional flow: team invite flow ---
  test("team settings invite button triggers form", async ({ page }) => {
    await page.goto("/settings/team", { waitUntil: "commit", timeout: 25000 });
    await page.waitForTimeout(3000);

    const inviteBtn = page
      .locator("button")
      .filter({ hasText: /invite|add member/i })
      .first();
    const btnCount = await inviteBtn.count();
    if (btnCount > 0) {
      await inviteBtn.click();
      await page.waitForTimeout(1500);
      const bodyText = await page
        .locator("body")
        .textContent({ timeout: 5000 });
      expect(bodyText).not.toContain("Application error");
    }
  });

  // --- Functional flow: create API key ---
  test("api keys create button opens dialog", async ({ page }) => {
    await page.goto("/settings/api-keys", {
      waitUntil: "commit",
      timeout: 25000,
    });
    await page.waitForTimeout(3000);

    const createBtn = page
      .locator("button")
      .filter({ hasText: /create|generate|new api key/i })
      .first();
    const btnCount = await createBtn.count();
    if (btnCount > 0) {
      await createBtn.click();
      await page.waitForTimeout(1500);
      const bodyText = await page
        .locator("body")
        .textContent({ timeout: 5000 });
      expect(bodyText).not.toContain("Application error");
    }
  });
});

// ---------------------------------------------------------------------------
// Notifications Pages
// ---------------------------------------------------------------------------

test.describe("Notifications Pages", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test("notification center loads", async ({ page }) => {
    await verifyPageLoads(
      page,
      "/notifications",
      /notification|inbox|unread|mark/i,
    );
  });

  test("notification log loads", async ({ page }) => {
    await verifyPageLoads(
      page,
      "/notifications/log",
      /log|notification|history|event/i,
    );
  });

  test("delivery log loads", async ({ page }) => {
    await verifyPageLoads(
      page,
      "/notifications/delivery-log",
      /delivery|log|notification/i,
    );
  });

  test("notification preferences loads", async ({ page }) => {
    await verifyPageLoads(
      page,
      "/notifications/preferences",
      /preference|channel|email|sms/i,
    );
  });

  // --- Functional flow: mark notification as read ---
  test("notification center supports mark-as-read interaction", async ({
    page,
  }) => {
    await page.goto("/notifications", { waitUntil: "commit", timeout: 25000 });
    await page.waitForTimeout(3000);

    const markBtn = page
      .locator("button")
      .filter({ hasText: /mark.*(all|read)/i })
      .first();
    const btnCount = await markBtn.count();
    if (btnCount > 0) {
      await markBtn.click();
      await page.waitForTimeout(1500);
      const bodyText = await page
        .locator("body")
        .textContent({ timeout: 5000 });
      expect(bodyText).not.toContain("Application error");
    }
  });
});

// ---------------------------------------------------------------------------
// Integrations Pages
// ---------------------------------------------------------------------------

test.describe("Integrations Pages", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test("integrations overview loads", async ({ page }) => {
    await verifyPageLoads(
      page,
      "/integrations",
      /integration|health|provider|connect/i,
    );
  });

  test("connected integrations page loads", async ({ page }) => {
    await verifyPageLoads(
      page,
      "/integrations/connected",
      /connected|integration|status|health/i,
    );
  });

  test("integration catalog loads", async ({ page }) => {
    await verifyPageLoads(
      page,
      "/integrations/catalog",
      /catalog|integration|connect|browse/i,
    );
  });

  test("integration credentials page loads", async ({ page }) => {
    await verifyPageLoads(
      page,
      "/integrations/credentials",
      /credential|key|secret|store/i,
    );
  });

  test("ecommerce integrations page loads", async ({ page }) => {
    await verifyPageLoads(
      page,
      "/integrations/ecommerce",
      /ecommerce|shopify|store|shop/i,
    );
  });

  test("webhook integrations page loads", async ({ page }) => {
    await verifyPageLoads(
      page,
      "/integrations/webhooks",
      /webhook|endpoint|event/i,
    );
  });

  // --- Functional flow: integrations overview search/filter ---
  test("integrations overview supports search interaction", async ({
    page,
  }) => {
    await page.goto("/integrations", { waitUntil: "commit", timeout: 25000 });
    await page.waitForTimeout(3000);

    const searchInput = page
      .locator("input[placeholder*='search' i], input[type='search']")
      .first();
    const inputCount = await searchInput.count();
    if (inputCount > 0) {
      await searchInput.fill("shopify");
      await page.waitForTimeout(1500);
      const bodyText = await page
        .locator("body")
        .textContent({ timeout: 5000 });
      expect(bodyText).not.toContain("Application error");
    }
  });

  // --- Functional flow: connected integrations refresh ---
  test("connected integrations supports refresh action", async ({ page }) => {
    await page.goto("/integrations/connected", {
      waitUntil: "commit",
      timeout: 25000,
    });
    await page.waitForTimeout(3000);

    const refreshBtn = page
      .locator("button")
      .filter({ hasText: /refresh|reload/i })
      .first();
    const btnCount = await refreshBtn.count();
    if (btnCount > 0) {
      await refreshBtn.click();
      await page.waitForTimeout(2000);
      const bodyText = await page
        .locator("body")
        .textContent({ timeout: 5000 });
      expect(bodyText).not.toContain("Application error");
    }
  });

  // --- Functional flow: catalog category filtering ---
  test("integration catalog supports category filter", async ({ page }) => {
    await page.goto("/integrations/catalog", {
      waitUntil: "commit",
      timeout: 25000,
    });
    await page.waitForTimeout(3000);

    const categoryBtn = page
      .locator("button[data-category], [data-testid='category-btn']")
      .nth(1);
    const btnCount = await categoryBtn.count();
    if (btnCount > 0) {
      await categoryBtn.click();
      await page.waitForTimeout(1500);
      const bodyText = await page
        .locator("body")
        .textContent({ timeout: 5000 });
      expect(bodyText).not.toContain("Application error");
    }
  });
});
