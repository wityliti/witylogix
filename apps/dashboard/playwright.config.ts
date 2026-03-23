import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  timeout: 30000,

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      // API server
      command:
        'node --import ./node_modules/.pnpm/node_modules/tsx/dist/esm/index.mjs ../../apps/api/src/server.ts',
      port: 8000,
      cwd: "../../",
      reuseExistingServer: true,
      timeout: 30000,
      env: {
        NODE_ENV: "development",
      },
    },
    {
      // Next.js dev server
      command: "npx next dev -p 3000",
      port: 3000,
      reuseExistingServer: true,
      timeout: 30000,
    },
  ],
});
