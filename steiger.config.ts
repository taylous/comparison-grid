import { defineConfig } from 'steiger';
import fsd from '@feature-sliced/steiger-plugin';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    files: ['./src/**'],
    rules: {
      // 빈/단일 사용 슬라이스 경고는 스캐폴딩 단계에서 비활성화한다.
      'fsd/insignificant-slice': 'off',
    },
  },
]);
