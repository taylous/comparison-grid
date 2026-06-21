import { defineConfig } from '@rslib/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  source: {
    // bundleless: 소스 파일을 1:1로 출력해 tree-shaking 을 보존한다.
    entry: {
      index: [
        './src/**/*.{ts,tsx}',
        '!./src/**/*.test.*',
        '!./src/**/*.spec.*',
        '!./src/**/*.stories.*',
      ],
    },
    // dts/alias 해석에 사용. paths alias 는 출력 시 상대경로로 재작성된다.
    tsconfigPath: './tsconfig.build.json',
  },
  lib: [
    {
      format: 'esm',
      bundle: false,
      dts: true,
      syntax: 'es2021',
    },
  ],
  output: {
    target: 'web',
    distPath: { root: 'dist' },
  },
  plugins: [pluginReact()],
});
