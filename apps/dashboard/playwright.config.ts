import { defineConfig, devices } from "@playwright/test";

/**
 * Dashboard Playwright config.
 *
 * Target selection:
 *   TARGET=local    → http://localhost:3003 + http://localhost:8000  (default)
 *   TARGET=staging  → Railway staging service URLs
 *
 * Run with `TARGET=staging pnpm -C apps/dashboard exec playwright test` to
 * exercise the deployed staging environment without spawning local servers.
 */

const TARGET = process.env.TARGET ?? "local";
const isStaging = TARGET === "staging";

const STAGING_DASHBOARD = "https://dashboard-staging-7d83.up.railway.app";
const STAGING_API = "https://witylogix-staging.up.railway.app";

const baseURL = isStaging
  ? (process.env.DASHBOARD_URL ?? STAGING_DASHBOARD)
  : "http://localhost:3003";

const apiURL = isStaging
  ? (process.env.API_URL ?? STAGING_API)
  : "http://localhost:8000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Against staging we can safely run 4 parallel workers — the seed demo
  // tenant has 25 orders / 8 customers / 5 drivers and Railway's rate limits
  // sit well above our test traffic. Drop to 1 worker locally if you see
  // flakiness on a single dev machine.
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : 4,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],
  timeout: 60000,

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  // Consumed by e2e/fixtures/auth.ts so tests don't hardcode URLs.
  metadata: {
    apiURL,
    target: TARGET,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Only spawn local servers when targeting local.
  ...(isStaging
    ? {}
    : {
        webServer: [
          {
            command:
              "node --import ./node_modules/.pnpm/node_modules/tsx/dist/esm/index.mjs ../../apps/api/src/server.ts",
            port: 8000,
            cwd: "../../",
            reuseExistingServer: true,
            timeout: 30000,
            env: {
              NODE_ENV: "development",
            },
          },
          {
            command: "npx next start -p 3003",
            port: 3003,
            reuseExistingServer: true,
            timeout: 30000,
          },
        ],
      }),
});
