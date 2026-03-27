import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: {
        global: {
          lines: 85,
        },
      },
    },
  },
  resolve: {
    alias: {
      // Resolve ~ path alias used in apps/shopify-app
      '~': fileURLToPath(new URL('./apps/shopify-app/app', import.meta.url)),
    },
  },
});
