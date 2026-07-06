import { defineConfig } from "tsup";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

export default defineConfig({
  entry: {
    index: "src/index.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom"],
  esbuildOptions(options) {
    options.banner = {
      js: "/* @witylogix/checkout-widget - Embeddable checkout widget */",
    };
  },
  async onSuccess() {
    console.log("Build succeeded");
  },
});
