// @ts-nocheck
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact()],
  build: {
    lib: {
      entry: "src/index.tsx",
      name: "WitylogixPOSUI",
      formats: ["es"],
      fileName: (format) => "index.js",
    },
    target: "es2020",
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        passes: 3,
      },
      output: {
        comments: false,
      },
    },
    rollupOptions: {
      output: {
        entryFileNames: "index.js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
    reportCompressedSize: false,
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
