/**
 * Vite configuration for the Shopify embedded admin app.
 *
 * Uses React Router v7 plugin for file-based routing and the
 * Polaris Web Components via CDN (no bundling needed — they're
 * loaded via <script> in root.tsx).
 */

import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [reactRouter(), tsconfigPaths()],
  server: {
    port: Number(process.env.PORT) || 3000,
    hmr: {
      protocol: "ws",
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      // Externalize server-side modules that must not be bundled:
      // - @witylogix/db: workspace package with native Prisma binaries
      // - @sentry/node: optional runtime dep (try-catch guarded in code)
      external: ["@witylogix/db", "@sentry/node"],
    },
  },
  ssr: {
    // Also externalize for SSR build — build.rollupOptions.external does not
    // apply to the SSR bundle. Without this Vite follows the workspace symlink
    // into packages/db/dist/index.js and fails to statically analyse the CJS
    // Prisma-generated client.
    external: ["@witylogix/db", "@prisma/client", "@sentry/node"],
  },
  resolve: {
    alias: {
      "~": new URL("./app", import.meta.url).pathname,
    },
  },
});
