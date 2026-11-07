import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Packaging tests build the same extension output directory.
    fileParallelism: false,
  },
});
