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

// Packages that must never be bundled — they are runtime deps resolved from
// node_modules. We need a resolveId plugin because pnpm workspace symlinks are
// followed before rollup's string-based external list is checked, which makes
// the bare package name never match. The plugin short-circuits resolution.
const SERVER_EXTERNALS = ["@witylogix/db", "@sentry/node", "@prisma/client"];
const serverExternalsPlugin = {
  name: "force-server-externals",
  resolveId(id: string) {
    if (
      SERVER_EXTERNALS.includes(id) ||
      id.includes("/packages/db/") ||
      id.startsWith("@sentry/")
    ) {
      return { id, external: true };
    }
  },
};

export default defineConfig({
  plugins: [reactRouter(), tsconfigPaths(), serverExternalsPlugin],
  server: {
    port: Number(process.env.PORT) || 3000,
    hmr: {
      protocol: "ws",
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      // Externalize server-side modules that must not be bundled.
      // Use a function so it matches both the bare package name AND the
      // resolved absolute file path (pnpm workspace symlinks are followed
      // before rollup's string-based external check runs).
      external: (id: string) =>
        id === "@witylogix/db" ||
        id.includes("/packages/db/") ||
        id === "@sentry/node" ||
        id.startsWith("@sentry/"),
    },
  },
  ssr: {
    // Externalize for SSR build as well. Vite also needs preserveSymlinks so
    // workspace symlinks don't resolve to absolute paths before the check.
    external: ["@witylogix/db", "@prisma/client", "@sentry/node"],
  },
  resolve: {
    // Prevent pnpm workspace symlinks from being followed before the external
    // check runs — keeps @witylogix/db as a bare package name so the external
    // list matches it correctly.
    preserveSymlinks: true,
    alias: {
      "~": new URL("./app", import.meta.url).pathname,
    },
  },
});
