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
// node_modules. enforce:'pre' ensures this runs before reactRouter() (which
// itself is a pre-plugin and resolves workspace symlinks before rollup's
// string-based external list runs). We intercept both the bare package name
// and any already-resolved absolute/relative path that includes the package.
const SERVER_EXTERNALS = ["@witylogix/db", "@sentry/node", "@prisma/client"];
const serverExternalsPlugin = {
  name: "force-server-externals",
  enforce: "pre" as const,
  resolveId(id: string, importer?: string) {
    // Bare package name (earliest interception point)
    if (SERVER_EXTERNALS.includes(id) || id.startsWith("@sentry/")) {
      return { id, external: true };
    }
    // Already-resolved file path that belongs to @witylogix/db
    // (matches both /absolute/packages/db/ and ../../packages/db/)
    if (id.includes("packages/db/")) {
      return { id: "@witylogix/db", external: true };
    }
    // Sub-import from inside the db package (e.g. './generated/prisma')
    if (importer && importer.includes("packages/db/")) {
      return { id: "@witylogix/db", external: true };
    }
  },
};

export default defineConfig({
  plugins: [serverExternalsPlugin, reactRouter(), tsconfigPaths()],
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
