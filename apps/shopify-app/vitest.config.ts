/// <reference types="vitest" />

/**
 * Vitest configuration for the Shopify embedded admin app.
 *
 * Deliberately does NOT include reactRouter() so that the plugin's SSR
 * transform doesn't stub out `*.client.ts` exports when collecting tests.
 * The `~` path alias is wired via tsconfigPaths (reads tsconfig.json paths).
 *
 * Client-only test files (*.client.test.*) run in jsdom to provide browser
 * globals (navigator.sendBeacon, window.location, etc.).
 */

import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths({ ignoreConfigErrors: true }) as any],
  test: {
    environmentMatchGlobs: [["**/*.client.test.*", "jsdom"]],
  },
});
