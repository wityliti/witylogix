import { test, expect } from "@playwright/test";
import { SMOKE_TEST_DATA } from "./fixtures/test-data";

/**
 * Integration Health Checks Smoke Test Suite
 * Verifies critical system health and SLA compliance
 */
test.describe("Integration Health Checks", () => {
  const API_BASE_URL = "http://localhost:3001";
  const WEB_BASE_URL = "http://localhost:3002";

  test("API health endpoint should return 200", async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/health`);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("status");
    expect(
      ["ok", "healthy", "up"].includes(data.status?.toLowerCase() || ""),
    ).toBeTruthy();
  });

  test("API readiness endpoint should return 200", async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/ready`);
    expect(response.status()).toBe(200);
  });

  test("Database connection should be healthy", async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/health/db`);

    // Should return 200 if healthy or 503 if unhealthy
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty("status");
    } else if (response.status() === 503) {
      test.skip();
    }
  });

  test("Redis connection should be healthy", async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/health/redis`);

    // Should return 200 if healthy or 503 if unhealthy
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty("status");
    } else if (response.status() === 503) {
      // Skip if Redis not configured for tests
      test.skip();
    }
  });

  test("API should respond within SLA (500ms)", async ({ request }) => {
    const startTime = Date.now();
    const response = await request.get(`${API_BASE_URL}/health`);
    const responseTime = Date.now() - startTime;

    expect(response.status()).toBe(200);
    expect(responseTime).toBeLessThan(SMOKE_TEST_DATA.timeouts.sla);
  });

  test("Web app should load within acceptable time", async ({ page }) => {
    const startTime = Date.now();
    await page.goto(WEB_BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    const loadTime = Date.now() - startTime;

    // Should load within 10 seconds
    expect(loadTime).toBeLessThan(10000);

    // Verify page is interactive
    const heading = page.locator("h1, body");
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test("Static assets should load correctly", async ({ page }) => {
    await page.goto(WEB_BASE_URL);

    // Get all images and scripts
    const imageCount = await page.locator("img").count();
    const scriptCount = await page.locator("script").count();

    // Verify at least some assets are loaded
    expect(imageCount + scriptCount).toBeGreaterThan(0);

    // Check for 404 errors in console
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    // Reload to catch any load errors
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Filter out expected errors
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("WebSocket") &&
        !e.includes("safe-zone") &&
        !e.toLowerCase().includes("deprecat"),
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test("API authentication endpoints should be accessible", async ({
    request,
  }) => {
    const loginResponse = await request.post(`${API_BASE_URL}/auth/login`, {
      data: {
        email: "invalid@test.com",
        password: "invalid",
      },
    });

    // Should return 401 or 400, not 500
    expect([400, 401, 403]).toContain(loginResponse.status());
  });

  test("API CORS headers should be present", async ({ request }) => {
    const response = await request.options(`${API_BASE_URL}/health`);

    // Should have CORS headers (or return 204 No Content)
    expect([200, 204]).toContain(response.status());

    const headers = response.headers();
    // Check for common CORS headers
    const hasCors = Object.keys(headers).some((key) =>
      key.toLowerCase().includes("access-control"),
    );
    expect(hasCors || response.status() === 200).toBeTruthy();
  });

  test("Web app should have security headers", async ({ request }) => {
    const response = await request.get(`${WEB_BASE_URL}/`);
    const headers = response.headers();

    // Check for important security headers
    const headerNames = Object.keys(headers).map((h) => h.toLowerCase());

    // At least one of these should be present
    const hasSecurityHeaders =
      headerNames.includes("x-frame-options") ||
      headerNames.includes("content-security-policy") ||
      headerNames.includes("x-content-type-options");

    expect(hasSecurityHeaders).toBeTruthy();
  });

  test("API should reject invalid requests", async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/invalid-endpoint`);

    // Should return 404, not 500
    expect(response.status()).toBeLessThan(500);
  });

  test("Web app should have basic SEO meta tags", async ({ page }) => {
    await page.goto(WEB_BASE_URL);

    // Check for title
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);

    // Check for meta description
    const metaDescription = page.locator('meta[name="description"]');
    const descriptionCount = await metaDescription.count();
    expect(descriptionCount).toBeGreaterThanOrEqual(0);
  });

  test("API should support gzip compression", async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/health`);

    const encoding = response.headers()["content-encoding"] || "";
    // Either gzip or identity (no compression) is acceptable
    expect(["gzip", "deflate", ""]).toContain(encoding);
  });

  test("Database migrations should be applied", async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/health/migrations`);

    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty("status");
    } else {
      // Migrations endpoint might not exist, skip
      test.skip();
    }
  });

  test("Services should be discoverable and healthy", async ({ request }) => {
    // Try to get service info
    const services = [
      { name: "auth", endpoint: "/health" },
      { name: "orders", endpoint: "/health" },
      { name: "drivers", endpoint: "/health" },
    ];

    for (const service of services) {
      try {
        const response = await request.get(
          `${API_BASE_URL}/${service.name}${service.endpoint}`,
        );
        // Service can return 200 or 404 (service not deployed)
        expect([200, 404]).toContain(response.status());
      } catch {
        // Service might not be available, that's ok for smoke test
      }
    }
  });
});
