import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 4,
      },
    },
    include: [
      'src/__tests__/**/*.test.ts',
      'src/**/__tests__/**/*.test.ts',
      '../../tests/unit/shipping/**/*.test.ts',
    ],
  },
});
