import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      include: ["**/__tests__/**/*.test.ts", "**/*.test.ts"],
      environment: "node",
      globals: true,
      coverage: {
        provider: "v8",
        reporter: ["text", "html", "json"],
        include: ["src/**/*.ts", "src/**/*.tsx"],
        exclude: [
          "node_modules/",
          "dist/",
          "coverage/",
          "**/*.test.ts",
          "**/__tests__/**",
          "**/node_modules/**",
        ],
        thresholds: {
          lines: 80,
          functions: 80,
          branches: 75,
          statements: 80,
        },
      },
    },
  },
  {
    test: {
      name: "unit",
      include: ["tests/unit/**/*.test.ts"],
      environment: "node",
      globals: true,
      coverage: {
        provider: "v8",
        thresholds: {
          lines: 85,
          functions: 85,
          branches: 80,
          statements: 85,
        },
      },
      setupFiles: ["tests/unit/setup.ts"],
    },
  },
  {
    test: {
      name: "integration",
      include: ["tests/integration/**/*.test.ts"],
      environment: "node",
      globals: true,
      timeout: 30000,
      coverage: {
        provider: "v8",
        thresholds: {
          lines: 60,
          functions: 60,
          branches: 50,
          statements: 60,
        },
      },
      setupFiles: ["tests/integration/setup.ts"],
    },
  },
  {
    test: {
      name: "e2e",
      include: ["tests/e2e/**/*.test.ts"],
      environment: "node",
      globals: true,
      timeout: 60000,
      coverage: {
        provider: "v8",
        thresholds: {
          lines: 40,
          functions: 40,
          branches: 30,
          statements: 40,
        },
      },
      setupFiles: ["tests/e2e/setup.ts"],
    },
  },
  {
    test: {
      name: "load",
      include: ["tests/load/**/*.test.ts"],
      environment: "node",
      globals: true,
      timeout: 120000,
      coverage: {
        enabled: false,
      },
      setupFiles: ["tests/load/setup.ts"],
    },
  },
  {
    test: {
      name: "performance",
      include: ["tests/performance/**/*.test.ts"],
      environment: "node",
      globals: true,
      timeout: 120000,
      coverage: {
        enabled: false,
      },
      setupFiles: ["tests/performance/setup.ts"],
    },
  },
]);
