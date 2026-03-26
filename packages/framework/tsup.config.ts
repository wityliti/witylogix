import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'workflow/index': 'src/workflow/index.ts',
    'container/index': 'src/container/index.ts',
    'types/index': 'src/types/index.ts',
    'queue/index': 'src/queue/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
});
