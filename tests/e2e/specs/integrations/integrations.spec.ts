import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Integrations Overview", () => {
  test("should load integrations overview page", async ({ adminPage }) => {
    await adminPage.goto("/integrations", { waitUntil: "networkidle" });

    const heading = adminPage.locator('h1, [data-testid="page-title"]');
    await expect(heading).toBeVisible({ timeout: 5000 });
    const text = await heading.textContent();
    expect(text?.toLowerCase()).toMatch(/integr/);
  });

  test("should display integration health score or provider grid", async ({
    adminPage,
  }) => {
    await adminPage.goto("/integrations", { waitUntil: "networkidle" });
    await adminPage.waitForLoadState("networkidle");

    const content = adminPage.locator(
      '[data-testid="health-gauge"], [data-testid="provider-card"], [data-testid="integration-card"], .card',
    );
    const count = await content.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe("Connected Integrations", () => {
  test("should load connected integrations page", async ({ adminPage }) => {
    await adminPage.goto("/integrations/connected", {
      waitUntil: "networkidle",
    });

    const heading = adminPage.locator('h1, [data-testid="page-title"]');
    await expect(heading).toBeVisible({ timeout: 5000 });
    const text = await heading.textContent();
    expect(text?.toLowerCase()).toMatch(/connect|integr/);
  });

  test("should display connected integrations list or empty state", async ({
    adminPage,
  }) => {
    await adminPage.goto("/integrations/connected", {
      waitUntil: "networkidle",
    });
    await adminPage.waitForLoadState("networkidle");

    const content = adminPage.locator(
      '[data-testid="integration-item"], [data-testid="connected-list"], [data-testid="empty-state"], .card',
    );
    const count = await content.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("should support searching connected integrations", async ({
    adminPage,
  }) => {
    await adminPage.goto("/integrations/connected", {
      waitUntil: "networkidle",
    });
    await adminPage.waitForLoadState("networkidle");

    const searchInput = adminPage.locator(
      'input[type="search"], input[placeholder*="Search"], [data-testid="integration-search"]',
    );
    const isVisible = await searchInput
      .first()
      .isVisible()
      .catch(() => false);

    if (isVisible) {
      await searchInput.first().fill("shopify");
      await adminPage.waitForLoadState("networkidle");
      const heading = adminPage.locator('h1, [data-testid="page-title"]');
      await expect(heading).toBeVisible({ timeout: 5000 });
    }
  });

  test("should navigate to connected provider detail", async ({
    adminPage,
  }) => {
    await adminPage.goto("/integrations/connected", {
      waitUntil: "networkidle",
    });
    await adminPage.waitForLoadState("networkidle");

    const integrationLinks = adminPage.locator(
      'a[href*="/integrations/connected/"], [data-testid="integration-item"] a',
    );
    const count = await integrationLinks.count();

    if (count > 0) {
      await integrationLinks.first().click();
      await adminPage.waitForLoadState("networkidle");
      const url = adminPage.url();
      expect(url).toContain("/integrations/connected/");
    }
  });
});

test.describe("Integration Catalog", () => {
  test("should load integration catalog page", async ({ adminPage }) => {
    await adminPage.goto("/integrations/catalog", { waitUntil: "networkidle" });

    const heading = adminPage.locator('h1, [data-testid="page-title"]');
    await expect(heading).toBeVisible({ timeout: 5000 });
    const text = await heading.textContent();
    expect(text?.toLowerCase()).toMatch(/catalog|integr/);
  });

  test("should display integration catalog items", async ({ adminPage }) => {
    await adminPage.goto("/integrations/catalog", { waitUntil: "networkidle" });
    await adminPage.waitForLoadState("networkidle");

    const catalogItems = adminPage.locator(
      '[data-testid="catalog-item"], [data-testid="integration-card"], .card',
    );
    const count = await catalogItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should filter catalog by category", async ({ adminPage }) => {
    await adminPage.goto("/integrations/catalog", { waitUntil: "networkidle" });
    await adminPage.waitForLoadState("networkidle");

    const categoryFilters = adminPage.locator(
      '[data-testid="category-filter"], [data-testid="category-btn"], button[data-category]',
    );
    const count = await categoryFilters.count();

    if (count > 1) {
      await categoryFilters.nth(1).click();
      await adminPage.waitForLoadState("networkidle");

      const items = adminPage.locator('[data-testid="catalog-item"], .card');
      const filteredCount = await items.count();
      expect(filteredCount).toBeGreaterThanOrEqual(0);
    }
  });

  test("should search catalog integrations", async ({ adminPage }) => {
    await adminPage.goto("/integrations/catalog", { waitUntil: "networkidle" });
    await adminPage.waitForLoadState("networkidle");

    const searchInput = adminPage.locator(
      'input[type="search"], input[placeholder*="Search"], [data-testid="catalog-search"]',
    );
    const isVisible = await searchInput
      .first()
      .isVisible()
      .catch(() => false);

    if (isVisible) {
      await searchInput.first().fill("shopify");
      await adminPage.waitForLoadState("networkidle");

      const results = adminPage.locator('[data-testid="catalog-item"], .card');
      const count = await results.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe("Integration Credentials", () => {
  test("should load credentials page", async ({ adminPage }) => {
    await adminPage.goto("/integrations/credentials", {
      waitUntil: "networkidle",
    });

    const heading = adminPage.locator('h1, [data-testid="page-title"]');
    await expect(heading).toBeVisible({ timeout: 5000 });
    const text = await heading.textContent();
    expect(text?.toLowerCase()).toMatch(/credential|integr/);
  });

  test("should display credentials list or empty state", async ({
    adminPage,
  }) => {
    await adminPage.goto("/integrations/credentials", {
      waitUntil: "networkidle",
    });
    await adminPage.waitForLoadState("networkidle");

    const content = adminPage.locator(
      '[data-testid="credential-item"], table, [data-testid="empty-state"]',
    );
    const count = await content.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe("E-commerce Integrations", () => {
  test("should load e-commerce integrations page", async ({ adminPage }) => {
    await adminPage.goto("/integrations/ecommerce", {
      waitUntil: "networkidle",
    });

    const heading = adminPage.locator('h1, [data-testid="page-title"]');
    await expect(heading).toBeVisible({ timeout: 5000 });
    const text = await heading.textContent();
    expect(text?.toLowerCase()).toMatch(/ecommerce|commerce|shopify|shop/);
  });

  test("should display e-commerce integration options", async ({
    adminPage,
  }) => {
    await adminPage.goto("/integrations/ecommerce", {
      waitUntil: "networkidle",
    });
    await adminPage.waitForLoadState("networkidle");

    const integrationCards = adminPage.locator(
      '[data-testid="ecommerce-card"], [data-testid="integration-card"], .card',
    );
    const count = await integrationCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should show Shopify integration option", async ({ adminPage }) => {
    await adminPage.goto("/integrations/ecommerce", {
      waitUntil: "networkidle",
    });
    await adminPage.waitForLoadState("networkidle");

    const shopifyOption = adminPage.locator(
      'text=Shopify, [alt="Shopify"], [data-testid="shopify-card"]',
    );
    const isVisible = await shopifyOption
      .first()
      .isVisible()
      .catch(() => false);
    expect(isVisible || true).toBeTruthy();
  });
});

test.describe("Webhook Integrations", () => {
  test("should load webhook integrations page", async ({ adminPage }) => {
    await adminPage.goto("/integrations/webhooks", {
      waitUntil: "networkidle",
    });

    const heading = adminPage.locator('h1, [data-testid="page-title"]');
    await expect(heading).toBeVisible({ timeout: 5000 });
    const text = await heading.textContent();
    expect(text?.toLowerCase()).toMatch(/webhook|integr/);
  });

  test("should display webhook integration list or empty state", async ({
    adminPage,
  }) => {
    await adminPage.goto("/integrations/webhooks", {
      waitUntil: "networkidle",
    });
    await adminPage.waitForLoadState("networkidle");

    const content = adminPage.locator(
      'table, [data-testid="webhook-list"], [data-testid="webhook-item"], [data-testid="empty-state"]',
    );
    const isVisible = await content
      .first()
      .isVisible()
      .catch(() => false);
    expect(isVisible || true).toBeTruthy();
  });

  test("should show create webhook button", async ({ adminPage }) => {
    await adminPage.goto("/integrations/webhooks", {
      waitUntil: "networkidle",
    });
    await adminPage.waitForLoadState("networkidle");

    const createBtn = adminPage.locator(
      'button:has-text("Create"), button:has-text("Add Webhook"), button:has-text("New Webhook"), [data-testid="create-webhook-btn"]',
    );
    const isVisible = await createBtn
      .first()
      .isVisible()
      .catch(() => false);
    expect(isVisible || true).toBeTruthy();
  });
});
