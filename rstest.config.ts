import { defineConfig } from '@rstest/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [pluginReact()],
  testEnvironment: 'jsdom',
  setupFiles: ['./rstest.setup.ts'],
  include: ['src/**/*.{test,spec}.{ts,tsx}'],
  coverage: {
    include: ['src/**/*.{ts,tsx}'],
    exclude: ['src/**/*.{test,spec,stories}.{ts,tsx}', 'src/**/index.ts'],
    thresholds: {
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
  },
});
