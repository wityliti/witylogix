import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@witylogix/validators': path.resolve(__dirname, './dist/index.cjs'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['**/schemas.test.ts'],
  },
});
