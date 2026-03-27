/**
 * Vite configuration for the Shopify embedded admin app.
 *
 * Uses React Router v7 plugin for file-based routing and the
 * Polaris Web Components via CDN (no bundling needed — they're
 * loaded via <script> in root.tsx).
 */

import { fileURLToPath } from "node:url";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const prismaClientBrowserStub = fileURLToPath(
  new URL("./app/stubs/prisma-client.browser-stub.ts", import.meta.url),
);

function isPrismaClientModuleId(id: string): boolean {
  if (id === "@prisma/client" || id.startsWith("@prisma/client/")) return true;
  // pnpm / Vite often pass absolute paths while pre-bundling dependencies
  if (id.includes("/@prisma/client/") || id.includes("\\@prisma\\client\\")) return true;
  if (id.endsWith("/@prisma/client") || id.endsWith("\\@prisma\\client")) return true;
  return false;
}

/** Resolve `@prisma/client` to a no-op stub during client / optimizeDeps scans only. */
const prismaClientBrowserStubPlugin = {
  name: "prisma-client-browser-stub",
  enforce: "pre" as const,
  resolveId(id: string, _importer?: string, options?: { ssr?: boolean }) {
    if (options?.ssr === true) return null;
    if (isPrismaClientModuleId(id)) {
      return prismaClientBrowserStub;
    }
    return null;
  },
};

// Packages that must never be bundled — they are runtime deps resolved from
// node_modules. enforce:'pre' ensures this runs before reactRouter() (which
// itself is a pre-plugin and resolves workspace symlinks before rollup's
// string-based external list runs). We intercept both the bare package name
// and any already-resolved absolute/relative path that includes the package.
const SERVER_EXTERNALS = [
  "@witylogix/db",
  "@sentry/node",
  "@prisma/client",
  "@shopify/shopify-app-session-storage-prisma",
];
const serverExternalsPlugin = {
  name: "force-server-externals",
  enforce: "pre" as const,
  resolveId(id: string, importer?: string) {
    // Bare package name (earliest interception point)
    if (SERVER_EXTERNALS.includes(id) || id.startsWith("@sentry/")) {
      return { id, external: true };
    }
    if (id.includes("shopify-app-session-storage-prisma")) {
      return { id: "@shopify/shopify-app-session-storage-prisma", external: true };
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
  plugins: [
    prismaClientBrowserStubPlugin,
    serverExternalsPlugin,
    reactRouter(),
    tsconfigPaths({ ignoreConfigErrors: true }),
  ],
  server: {
    // Shopify CLI injects PORT so the HTTPS proxy can reach this dev server.
    port: Number(process.env.PORT) || 3000,
    strictPort: true,
    hmr: {
      protocol: "ws",
    },
  },
  // @prisma/client is server-only; Vite must not pre-bundle it for the client.
  // - `exclude` prevents it from being a top-level optimizeDeps entry.
  // - `esbuildOptions.external` prevents esbuild from bundling it even when it
  //   appears as a transitive dep of another optimized package (e.g. the Prisma
  //   session-storage package). Without this, esbuild would try to process
  //   @prisma/client/index-browser.js which requires '.prisma/client/index-browser'
  //   — a pnpm package-name require that esbuild misreads as a relative path.
  optimizeDeps: {
    exclude: [
      "@prisma/client",
      "@witylogix/db",
      "@shopify/shopify-app-session-storage-prisma",
    ],
    // `external` is intentionally excluded from Vite's esbuildOptions type
    // but is supported at runtime to prevent esbuild from bundling Prisma
    // transitive deps during dependency pre-optimisation.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    esbuildOptions: {
      external: [
        "@prisma/client",
        "@shopify/shopify-app-session-storage-prisma",
      ],
    } as any,
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
        id.startsWith("@sentry/") ||
        id.includes("shopify-app-session-storage-prisma"),
    },
  },
  ssr: {
    // Externalize for SSR build as well. Vite also needs preserveSymlinks so
    // workspace symlinks don't resolve to absolute paths before the check.
    external: [
      "@witylogix/db",
      "@prisma/client",
      "@sentry/node",
      "@shopify/shopify-app-session-storage-prisma",
    ],
    optimizeDeps: {
      exclude: [
        "@prisma/client",
        "@witylogix/db",
        "@shopify/shopify-app-session-storage-prisma",
      ],
    },
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
