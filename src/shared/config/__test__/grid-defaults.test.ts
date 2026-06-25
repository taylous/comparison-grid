import { describe, expect, it } from '@rstest/core';
import { DEFAULT_CELL_HEIGHT } from '@shared/config';

describe('shared/config', () => {
  it('DEFAULT_CELL_HEIGHT 는 20 (모든 grid 공통 estimate)', () => {
    expect(DEFAULT_CELL_HEIGHT).toBe(20);
  });
});
