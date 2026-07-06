import { chromium, FullConfig } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const authFile = path.join(__dirname, "auth.json");
const apiUrl = "http://localhost:3001";
const dashboardUrl = "http://localhost:3002";

/**
 * Wait for service to be available
 */
async function waitForUrl(
  url: string,
  maxRetries: number = 30,
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.ok || response.status === 404) {
        console.log(`✓ Service ready: ${url}`);
        return true;
      }
    } catch (error) {
      console.log(`Waiting for ${url}... (${i + 1}/${maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  return false;
}

/**
 * Authenticate and save auth state
 */
async function authenticateUser(): Promise<void> {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(`${dashboardUrl}/login`, { waitUntil: "networkidle" });

    // Login with test admin credentials
    const email = process.env.TEST_ADMIN_EMAIL || "admin@test.com";
    const password = process.env.TEST_ADMIN_PASSWORD || "admin123";

    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await page.waitForURL(`${dashboardUrl}/dashboard`, { timeout: 10000 });

    // Save auth state
    await context.storageState({ path: authFile });
    console.log(`✓ Auth state saved to ${authFile}`);
  } catch (error) {
    console.error("Failed to authenticate:", error);
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * Seed test data via API
 */
async function seedTestData(): Promise<void> {
  try {
    const response = await fetch(`${apiUrl}/api/test/seed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        includeOrders: true,
        includeDrivers: true,
        includeWebhooks: true,
      }),
    });

    if (response.ok) {
      console.log("✓ Test data seeded successfully");
    } else {
      console.log("⚠ Test seed endpoint not available (optional)");
    }
  } catch (error) {
    console.log(
      "⚠ Could not seed test data (optional feature):",
      (error as Error).message,
    );
  }
}

/**
 * Global setup
 */
async function globalSetup(config: FullConfig): Promise<void> {
  console.log("Starting global setup...");

  // Wait for services to be ready
  console.log("Waiting for API service...");
  const apiReady = await waitForUrl(`${apiUrl}/health`);
  if (!apiReady) {
    throw new Error(`API service not ready at ${apiUrl}`);
  }

  console.log("Waiting for Dashboard...");
  const dashboardReady = await waitForUrl(`${dashboardUrl}`);
  if (!dashboardReady) {
    throw new Error(`Dashboard not ready at ${dashboardUrl}`);
  }

  // Seed test data
  await seedTestData();

  // Authenticate and save state
  if (!fs.existsSync(authFile)) {
    console.log("Authenticating user...");
    await authenticateUser();
  } else {
    console.log("✓ Using existing auth state");
  }

  console.log("✓ Global setup completed\n");
}

export default globalSetup;
