import { defineConfig, devices } from '@playwright/test';

/**
 * Regression Test Configuration
 * Comprehensive Playwright configuration for regression testing suite
 *
 * Supports:
 * - Multiple browsers: Chromium, Firefox, WebKit
 * - Parallel execution: 4 workers for CI sharding
 * - Retries: 2 retries in CI for flaky tests
 * - Reporters: HTML, JUnit (for CI), JSON
 * - Timeouts: 30s per test, 5s per assertion
 *
 * Run with: npx playwright test --config=tests/regression/playwright.regression.config.ts
 * Update baselines: UPDATE_BASELINES=true npx playwright test --config=tests/regression/playwright.regression.config.ts
 */

export default defineConfig({
  testDir: './tests/regression',
  testMatch: '**/*.spec.ts',

  /* Fail the build if tests are marked with .only() */
  forbidOnly: !!process.env.CI,

  /* Retry strategy: more retries in CI for flaky tests, none locally */
  retries: process.env.CI ? 2 : 0,

  /* Workers: Parallel execution for faster runs
     Local: 1 for debugging
     CI: 4 for sharding across machines
  */
  workers: process.env.CI ? 4 : 1,

  /* Global test timeout: 30 seconds per test */
  timeout: 30 * 1000,

  /* Expect assertion timeout: 5 seconds */
  expect: {
    timeout: 5000,
  },

  /* Reporter configurations */
  reporter: [
    /* HTML report for visual inspection */
    ['html', { outputFolder: 'tests/regression/results/html' }],

    /* JUnit XML for CI integration (GitHub Actions) */
    ['junit', { outputFile: 'tests/regression/results/junit.xml' }],

    /* JSON report for programmatic processing */
    ['json', { outputFile: 'tests/regression/results/results.json' }],

    /* Console list for terminal output */
    ['list'],
  ],

  /* Base URL for all tests */
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3002',

    /* Trace: captures detailed execution logs on retry */
    trace: 'on-first-retry',

    /* Screenshot: capture on failure for debugging */
    screenshot: 'only-on-failure',

    /* Video: record on failure for detailed inspection */
    video: 'retain-on-failure',

    /* Action timeout: individual action timeout */
    actionTimeout: 5000,
  },

  /* Projects define browser and device combinations to test */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Optional: Test on mobile devices
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
    */
  ],

  /* Web servers to start and manage for tests */
  webServer: [
    {
      /* Start web app server */
      command: 'npm run dev',
      url: 'http://localhost:3002',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      /* Start API server */
      command: 'npm run dev --workspace=@witylogix/api',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],

  /* Global setup for shared test initialization */
  globalSetup: require.resolve('../e2e/global-setup.ts'),

  /* Global teardown for cleanup */
  globalTeardown: require.resolve('../e2e/global-teardown.ts'),

  /* Snapshot configuration for visual regression */
  snapshotPathTemplate: 'tests/regression/visual/baselines/{testFileDir}/{testFileName}-{platform}{ext}',

  /* Update snapshots when flag is set */
  updateSnapshots: process.env.UPDATE_SNAPSHOTS === 'true' || process.env.UPDATE_BASELINES === 'true',

  /* Use stable snapshots across runs */
  snapshotDir: 'tests/regression/visual/baselines',
});
