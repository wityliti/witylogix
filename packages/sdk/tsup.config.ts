/**
 * tsup configuration for @witylogix/sdk
 * Builds TypeScript SDK into both CommonJS and ESM formats
 */

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: false,
  shims: true,
});
