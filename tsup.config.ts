import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true, // Generate declaration file
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: true, // Reduce bundle size (< 3KB goal)
  treeshake: true,
});
