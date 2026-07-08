import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
  },
  format: ["cjs", "esm"],
  dts: { resolve: true },
  sourcemap: true,
  clean: true,
  outDir: "dist",
});
