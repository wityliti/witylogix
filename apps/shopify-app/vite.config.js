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
    port: 3000,
    hmr: {
      protocol: "ws",
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      external: [],
    },
  },
  resolve: {
    alias: {
      "~": new URL("./app", import.meta.url).pathname,
    },
  },
});
//# sourceMappingURL=vite.config.js.map
