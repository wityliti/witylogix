import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["app/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "~": resolve(__dirname, "app"),
    },
  },
});
