// 테스트 런타임 전역 셋업.
// jest-dom matcher 를 rstest 의 expect 에 연결한다. (런타임 전용)
import * as matchers from '@testing-library/jest-dom/matchers';
import { expect } from '@rstest/core';

expect.extend(matchers);
