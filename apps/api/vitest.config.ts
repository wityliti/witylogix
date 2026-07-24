import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/__tests__/**/*.test.ts", "**/*.test.ts"],
    pool: "forks",
    poolOptions: {
      forks: {
        minForks: 0,
        maxForks: 4,
      },
    },
  },
});
