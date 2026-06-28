/**
 * computeRowHeights 단위 테스트
 *
 * 근거: requirements.md "행 높이 정책"
 * - 행 i 높이 = 모든 grid의 행 i 자연 높이 중 최댓값 (cross-grid max).
 * - estimate는 전역 최소 높이(floor). 미측정 행뿐 아니라 측정값이 estimate 미만인 행도
 *   estimate로 끌어올린다. 이 floor가 없으면 totalHeight가 grid 간 어긋나 스크롤 동기화가 깨진다.
 * - column toggle 후 재계산 시 영향은 토글한 grid에만 국한되지 않고 전 grid에 전파된다.
 *   (계산 단계; 전파 자체는 container 책임이나 이 함수가 올바른 최댓값을 돌려줘야 한다)
 */
import { describe, it, expect } from '@rstest/core';
import { computeRowHeights } from '@entities/geometry';
import type { NaturalHeights } from '@entities/geometry';

describe('computeRowHeights', () => {
  // -------------------------------------------------------------------------
  // 케이스 1: 빈 Map → 모든 행이 estimate
  // 요구사항: 측정된 grid가 없으면 모든 행이 estimate(floor) 값이어야 한다.
  // -------------------------------------------------------------------------
  it('빈 Map을 전달하면 모든 행이 estimate 값으로 채워진다', () => {
    const heights: NaturalHeights = new Map();

    const result = computeRowHeights(heights, 3, 20);

    expect(result).toEqual([20, 20, 20]);
  });

  // -------------------------------------------------------------------------
  // 케이스 2: rowCount=0 → 빈 배열
  // 요구사항: 행이 없는 grid는 레이아웃 계산 대상이 없으므로 빈 배열이어야 한다.
  // -------------------------------------------------------------------------
  it('rowCount가 0이면 빈 배열을 반환한다', () => {
    const heights: NaturalHeights = new Map();

    const result = computeRowHeights(heights, 0, 20);

    expect(result).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // 케이스 3: 반환 배열 길이 === rowCount
  // 요구사항: rowHeights[i]는 행 i에 1:1 대응하므로 길이가 rowCount와 같아야 한다.
  // WHY: 길이가 짧으면 뒷 행의 offset 계산이 undefined를 참조하고,
  //      길이가 길면 없는 행에 대한 offset이 생겨 totalHeight가 오염된다.
  // -------------------------------------------------------------------------
  it('반환 배열의 길이는 항상 rowCount와 같다', () => {
    const heights: NaturalHeights = new Map([
      ['g1', [30, 40, 50]],
    ]);

    const result = computeRowHeights(heights, 5, 20);

    expect(result).toHaveLength(5);
    // 인덱스 0~2는 측정값(각각 estimate 이상이므로 그대로), 인덱스 3·4는 grid 배열에 없으므로 estimate로 채워진다
    expect(result).toEqual([30, 40, 50, 20, 20]);
  });

  // -------------------------------------------------------------------------
  // 케이스 4: cross-grid max — 여러 grid의 같은 index 행 중 최댓값
  // 요구사항: "grid 3개의 2행 자연 높이가 20/40/30이면 → 2행은 모두 40"
  // estimate(10)보다 큰 40이 선택되어야 한다.
  // -------------------------------------------------------------------------
  it('3개 grid의 같은 index 행 자연 높이 20/40/30이면 결과는 40이다', () => {
    const heights: NaturalHeights = new Map([
      ['g1', [undefined, 20, undefined]],
      ['g2', [undefined, 40, undefined]],
      ['g3', [undefined, 30, undefined]],
    ]);

    const result = computeRowHeights(heights, 3, 10);

    expect(result).toEqual([10, 40, 10]);
  });

  // -------------------------------------------------------------------------
  // 케이스 5: 미측정 행(undefined) → estimate
  // 요구사항: 화면 밖 행처럼 아직 측정되지 않은(undefined) 행은 estimate로 대체한다.
  // -------------------------------------------------------------------------
  it('미측정(undefined) 행은 estimate로 처리한다', () => {
    const heights: NaturalHeights = new Map([
      ['g1', [undefined, 30, undefined]],
    ]);

    const result = computeRowHeights(heights, 3, 20);

    expect(result).toEqual([20, 30, 20]);
  });

  // -------------------------------------------------------------------------
  // 케이스 6: grid 배열이 rowCount보다 짧아 인덱스가 없는 경우 → estimate
  // 요구사항: "grid 배열이 rowCount보다 짧아 인덱스가 없는 경우 estimate로 처리"
  // WHY: JavaScript 배열은 범위 밖 인덱스에 undefined를 반환한다. 이는 미측정과 동일하게
  //      처리되어야 한다. 두 grid의 배열 길이가 달라도 rowCount를 기준으로 일치해야 한다.
  // -------------------------------------------------------------------------
  it('grid 배열이 rowCount보다 짧아 인덱스가 없는 행은 estimate로 처리한다', () => {
    const heights: NaturalHeights = new Map([
      ['g1', [25, 35]],   // 인덱스 2, 3 없음
    ]);

    const result = computeRowHeights(heights, 4, 20);

    expect(result).toEqual([25, 35, 20, 20]);
  });

  // -------------------------------------------------------------------------
  // 케이스 7: estimate는 전역 floor — 측정값이 estimate보다 작아도 estimate로 끌어올린다
  // 요구사항: "estimate는 전역 최소 높이(floor)다. 측정값이 20보다 작은 행도 20으로 끌어올린다."
  // WHY: 모든 grid가 동일한 floor를 공유해야 totalHeight가 grid 간 어긋나지 않아
  //      스크롤 동기화가 유지된다.
  // -------------------------------------------------------------------------
  it('측정값이 estimate보다 작아도 결과는 estimate로 끌어올려진다', () => {
    const heights: NaturalHeights = new Map([
      ['g1', [10, 25]],   // 10 < 20(estimate)
    ]);

    const result = computeRowHeights(heights, 2, 20);

    expect(result).toEqual([20, 25]);
  });

  // -------------------------------------------------------------------------
  // 케이스 8: 모든 grid가 측정했더라도 전부 estimate 미만이면 estimate가 우선
  // 요구사항: 이것이 핵심 변경점. "모든 grid가 측정했더라도 측정값이 estimate보다 작으면
  //           결과는 estimate로 끌어올려진다."
  // WHY: grid 간 스크롤 동기화를 위한 totalHeight 일치 보장.
  // -------------------------------------------------------------------------
  it('모든 grid가 동일 행을 측정했어도 전부 estimate 미만이면 결과는 estimate이다', () => {
    const heights: NaturalHeights = new Map([
      ['g1', [5]],
      ['g2', [8]],
      ['g3', [12]],
    ]);

    const result = computeRowHeights(heights, 1, 20);

    expect(result).toEqual([20]);
  });

  // -------------------------------------------------------------------------
  // 케이스 9: 측정값이 estimate보다 크면 측정값을 사용한다
  // 요구사항: estimate는 최소(floor)일 뿐, 측정값이 더 크면 측정값이 사용된다.
  // -------------------------------------------------------------------------
  it('측정값이 estimate보다 크면 측정값을 그대로 사용한다', () => {
    const heights: NaturalHeights = new Map([
      ['g1', [50]],
    ]);

    const result = computeRowHeights(heights, 1, 20);

    expect(result).toEqual([50]);
  });

  // -------------------------------------------------------------------------
  // 케이스 10: 혼합 케이스 — 일부 grid만 측정, 다른 grid는 undefined
  // 요구사항: "일부 grid만 어떤 행을 측정하고 다른 grid는 미측정(undefined)인 혼합 케이스"
  // 측정한 grid의 값이 사용되고 미측정 grid는 무시된다.
  // -------------------------------------------------------------------------
  it('일부 grid만 어떤 행을 측정하고 나머지가 undefined인 혼합 케이스에서 측정값 중 최댓값을 반환한다', () => {
    const heights: NaturalHeights = new Map([
      ['g1', [undefined, 30]],   // row 0: 미측정, row 1: 30
      ['g2', [45, undefined]],   // row 0: 45,    row 1: 미측정
    ]);

    const result = computeRowHeights(heights, 2, 20);

    // row 0: max(estimate=20, 45) = 45
    // row 1: max(estimate=20, 30) = 30
    expect(result).toEqual([45, 30]);
  });

  // -------------------------------------------------------------------------
  // 케이스 11: 여러 grid + estimate floor가 혼합된 복합 케이스
  // 요구사항: cross-grid max와 estimate floor가 모두 작동하는 종합 케이스.
  // -------------------------------------------------------------------------
  it('여러 grid에 걸쳐 각 행의 cross-grid max를 estimate floor와 함께 올바르게 계산한다', () => {
    const heights: NaturalHeights = new Map([
      ['g1', [100, undefined, 20]],
      ['g2', [80, 60, 5]],
      ['g3', [undefined, 90, undefined]],
    ]);

    // estimate = 25
    // row 0: max(100, 80) = 100 (estimate 25보다 크므로 100)
    // row 1: max(60, 90) = 90  (g1 undefined → 무시)
    // row 2: max(20, 5) = 20, 둘 다 25(estimate) 미만 → 25로 끌어올림
    const result = computeRowHeights(heights, 3, 25);

    expect(result).toEqual([100, 90, 25]);
  });

  // -------------------------------------------------------------------------
  // 케이스 12: 측정값이 estimate와 정확히 같은 경우
  // 요구사항: estimate보다 strictly 큰 경우에만 측정값으로 교체한다.
  //           estimate와 같은 값은 estimate 그대로이므로 결과에 차이가 없다.
  // -------------------------------------------------------------------------
  it('측정값이 estimate와 정확히 같으면 estimate(= 측정값)를 반환한다', () => {
    const heights: NaturalHeights = new Map([
      ['g1', [20]],   // 20 === estimate(20)
    ]);

    const result = computeRowHeights(heights, 1, 20);

    expect(result).toEqual([20]);
  });

  // -------------------------------------------------------------------------
  // 케이스 13: 빈 배열 항목이 있는 grid (길이 0 배열 → 모든 행이 undefined)
  // WHY: grid가 아무것도 측정하지 않은 상태를 빈 배열로 표현할 수 있다.
  //      모든 행이 undefined이므로 estimate로 처리된다.
  // -------------------------------------------------------------------------
  it('grid 배열이 길이 0이면 해당 grid의 모든 행은 미측정으로 처리된다', () => {
    const heights: NaturalHeights = new Map([
      ['g1', []],       // 아무것도 측정하지 않음
      ['g2', [40, 60]], // 측정됨
    ]);

    const result = computeRowHeights(heights, 2, 20);

    // g1은 모두 undefined → 무시, g2의 40, 60이 사용됨 (둘 다 estimate 이상)
    expect(result).toEqual([40, 60]);
  });

  // -------------------------------------------------------------------------
  // 케이스 14: 입력 naturalHeights를 변형하지 않는다 (순수성)
  // 요구사항: 순수 함수. 입력 Map과 내부 배열을 변형하지 않는다.
  // WHY: naturalHeights는 container의 캐시이므로 계산 함수가 변형하면
  //      다음 측정에서 오염된 캐시를 사용하게 된다.
  // -------------------------------------------------------------------------
  it('입력 naturalHeights의 Map과 내부 배열을 변형하지 않는다', () => {
    const originalArray: ReadonlyArray<number | undefined> = [30, 40, 50];
    const heights: NaturalHeights = new Map([['g1', originalArray]]);

    computeRowHeights(heights, 3, 20);

    // Map 자체가 유지되어야 한다
    expect(heights.size).toBe(1);
    // 내부 배열이 동일한 참조여야 한다 (복사본으로 교체되지 않음)
    expect(heights.get('g1')).toBe(originalArray);
    // 배열 내용이 변경되지 않아야 한다
    expect(heights.get('g1')).toEqual([30, 40, 50]);
  });

  // -------------------------------------------------------------------------
  // 케이스 15: 단일 grid, 단일 행 (경계값)
  // WHY: 최소 단위 입력이 올바르게 처리되는지 확인한다.
  // -------------------------------------------------------------------------
  it('단일 grid, 단일 행은 해당 측정값을 그대로 반환한다 (estimate보다 큰 경우)', () => {
    const heights: NaturalHeights = new Map([['g1', [48]]]);

    const result = computeRowHeights(heights, 1, 20);

    expect(result).toEqual([48]);
  });

  // -------------------------------------------------------------------------
  // 케이스 16: estimate=0 경계 — floor가 0이면 측정값은 그대로, 미측정은 0
  // 요구사항: estimate는 전역 최소 높이(floor)다. estimate=0이면 floor가 0이므로
  //           0보다 큰 측정값은 그대로 사용되고, 미측정 행은 0이 된다.
  // WHY: estimate=0은 유효한 입력이다. floor 적용 로직이 경계값에서도 일관되게
  //      동작해야 스크롤 동기화가 무너지지 않는다.
  // -------------------------------------------------------------------------
  it('estimate가 0이면 측정된 행은 그대로 사용되고 미측정 행은 0이 된다', () => {
    const heights: NaturalHeights = new Map([
      ['g1', [10, undefined, 30]],
    ]);

    const result = computeRowHeights(heights, 3, 0);

    // row 0: max(10, floor=0) = 10
    // row 1: undefined → estimate=0
    // row 2: max(30, floor=0) = 30
    expect(result).toEqual([10, 0, 30]);
  });

  // -------------------------------------------------------------------------
  // 케이스 17: grid 배열이 rowCount보다 긴 경우 → 여분 인덱스는 무시
  // 요구사항: rowCount를 넘는 여분 인덱스는 무시되고 결과 길이는 rowCount와 같아야 한다.
  // WHY: 결과 길이가 rowCount를 초과하면 없는 행의 offset이 생겨 totalHeight가 오염된다.
  //      케이스 3(배열이 짧을 때)의 대칭적인 경계다.
  // -------------------------------------------------------------------------
  it('grid 배열이 rowCount보다 길면 rowCount를 넘는 인덱스는 무시하고 결과 길이는 rowCount와 같다', () => {
    const heights: NaturalHeights = new Map([
      ['g1', [10, 20, 30, 40, 50]],   // 길이 5, rowCount=3
    ]);

    const result = computeRowHeights(heights, 3, 5);

    expect(result).toHaveLength(3);
    // 인덱스 3(40), 4(50)는 rowCount 범위 밖이므로 결과에 나타나지 않는다
    expect(result).toEqual([10, 20, 30]);
  });
});
