import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke Test Configuration
 * Focused configuration for critical path testing
 * Run with: npx playwright test --config=tests/e2e/smoke/playwright.smoke.config.ts
 */
export default defineConfig({
  testDir: "./tests/e2e/smoke",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  reporter: [
    ["html", { outputFolder: "tests/e2e/results/smoke" }],
    ["json", { outputFile: "tests/e2e/results/smoke/results.json" }],
    ["list"],
    ["junit", { outputFile: "tests/e2e/results/smoke/junit.xml" }],
  ],
  use: {
    baseURL: "http://localhost:3002",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 5000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:3002",
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: "npm run dev --workspace=@witylogix/api",
      url: "http://localhost:3001/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
  globalSetup: require.resolve("../global-setup.ts"),
  globalTeardown: require.resolve("../global-teardown.ts"),
});
