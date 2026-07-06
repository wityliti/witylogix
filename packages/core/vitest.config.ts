import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    pool: "forks",
    poolOptions: {
      forks: {
        minForks: 1,
        maxForks: 2,
        execArgv: ["--max-old-space-size=4096"],
      },
    },
    include: [
      "src/__tests__/**/*.test.ts",
      "src/**/__tests__/**/*.test.ts",
      "../../tests/unit/shipping/**/*.test.ts",
    ],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      // Integration tests that require a live DATABASE_URL (Postgres).
      // Run these in the integration CI job with DB provisioned, not in unit tests.
      "src/tenant/__tests__/api-key-service.test.ts",
      "src/tenant/__tests__/tenant-resolver.test.ts",
      "src/tenant/__tests__/usage-meter.test.ts",
      "src/webhooks/__tests__/event-bridge.test.ts",
      "src/integrations/couriers/__tests__/partner-rating.test.ts",
    ],
  },
});
