import { describe, expect, it } from '@rstest/core';

// rstest + jsdom 환경이 동작하는지 확인하는 스모크 테스트.
describe('rstest + jsdom', () => {
  it('DOM API 를 사용할 수 있다', () => {
    const el = document.createElement('div');
    el.textContent = 'comparison-grid';
    document.body.appendChild(el);

    expect(document.body.contains(el)).toBe(true);
    expect(el.textContent).toBe('comparison-grid');
  });
});
