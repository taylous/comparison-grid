/**
 * measureHeights 단위 테스트
 *
 * 근거: requirements.md "성능 가드레일" — read-then-write 배칭의 read 단계 프리미티브.
 * - getBoundingClientRect() 를 통해 각 element 의 height 를 읽는다.
 * - 모든 측정을 먼저 읽고(write 없이) 호출자가 일괄 처리한다.
 * - 입력 순서를 그대로 유지해 rowHeights 배열 인덱스와 대응시킨다.
 *
 * jsdom 의 getBoundingClientRect 는 항상 0 을 반환하므로
 * 테스트에서 element 별로 mock 한다.
 */
import { describe, it, expect, afterEach } from '@rstest/core';
import { rstest } from '@rstest/core';
import { measureHeights } from '@shared/lib';

// ── 헬퍼 ──────────────────────────────────────────────────────────────────

/**
 * 지정한 height 를 반환하는 getBoundingClientRect spy 를 element 에 주입한다.
 * afterEach 에서 복구하기 위해 원본 메서드를 반환한다.
 */
function stubHeight(
  el: Element,
  height: number,
): { restore: () => void } {
  const spy = rstest.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    height,
    width: 0,
    top: 0,
    left: 0,
    bottom: height,
    right: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);

  return {
    restore: () => {
      spy.mockRestore();
    },
  };
}

// ── 정리 ──────────────────────────────────────────────────────────────────

const restoreQueue: Array<() => void> = [];

afterEach(() => {
  for (const restore of restoreQueue) {
    restore();
  }
  restoreQueue.length = 0;
});

// ── 테스트 ────────────────────────────────────────────────────────────────

describe('measureHeights', () => {
  /**
   * 케이스 1: 각 element 의 getBoundingClientRect().height 를 입력 순서대로 반환한다.
   *
   * 근거: rowHeights[i] 는 배열 인덱스 i 의 element 높이여야 한다.
   * 순서가 바뀌면 cross-grid max 계산이 어긋난다.
   */
  it('각 element 의 높이를 입력 순서대로 반환한다', () => {
    const el0 = document.createElement('div');
    const el1 = document.createElement('div');
    const el2 = document.createElement('div');

    restoreQueue.push(stubHeight(el0, 20).restore);
    restoreQueue.push(stubHeight(el1, 40).restore);
    restoreQueue.push(stubHeight(el2, 30).restore);

    const result = measureHeights([el0, el1, el2]);

    expect(result).toEqual([20, 40, 30]);
  });

  /**
   * 케이스 2: 빈 배열을 넘기면 빈 배열을 반환한다.
   *
   * 근거: 가상화된 뷰에서 보이는 행이 없을 때 measureHeights 를 호출할 수 있다.
   * 빈 입력에 대해 안전하게 빈 결과를 반환해야 한다.
   */
  it('빈 배열을 넘기면 빈 배열을 반환한다', () => {
    const result = measureHeights([]);
    expect(result).toEqual([]);
  });

  /**
   * 케이스 3: element 가 하나인 경우.
   *
   * 근거: 단일 element 처리가 복수 element 와 동일하게 동작해야 한다 (경계값).
   */
  it('element 가 하나인 경우 길이 1 의 배열을 반환한다', () => {
    const el = document.createElement('div');
    restoreQueue.push(stubHeight(el, 56).restore);

    const result = measureHeights([el]);

    expect(result).toEqual([56]);
  });

  /**
   * 케이스 4: 반환 배열의 길이가 입력 배열의 길이와 같다.
   *
   * 근거: rowHeights 배열이 elements 배열과 1:1 대응이어야
   * 인덱스 기반 접근(rowHeights[i])이 안전하다.
   */
  it('반환 배열의 길이가 입력 배열의 길이와 같다', () => {
    const elements = [
      document.createElement('div'),
      document.createElement('div'),
      document.createElement('div'),
      document.createElement('div'),
    ];

    for (const el of elements) {
      restoreQueue.push(stubHeight(el, 24).restore);
    }

    const result = measureHeights(elements);

    expect(result).toHaveLength(elements.length);
  });

  /**
   * 케이스 5: height 가 0 인 element 도 그대로 0 을 반환한다.
   *
   * 근거: display:none 이나 height:0 인 element 는 실제로 0 이며,
   * 다른 값으로 대체하면 max 계산이 오염된다.
   */
  it('height 가 0 인 element 는 0 을 반환한다', () => {
    const el = document.createElement('div');
    restoreQueue.push(stubHeight(el, 0).restore);

    const result = measureHeights([el]);

    expect(result).toEqual([0]);
  });

  /**
   * 케이스 6: 입력 배열을 변형하지 않는다 (readonly 계약).
   *
   * 근거: measureHeights 는 read-only 함수이며, 입력 배열을 절대로 변경해서는 안 된다.
   * 소스 시그니처가 `readonly Element[]` 를 받으므로 이를 보장해야 한다.
   */
  it('입력 배열을 변형하지 않는다', () => {
    const el0 = document.createElement('div');
    const el1 = document.createElement('div');

    restoreQueue.push(stubHeight(el0, 10).restore);
    restoreQueue.push(stubHeight(el1, 20).restore);

    const inputArray: readonly Element[] = [el0, el1];
    const snapshot = [...inputArray];

    measureHeights(inputArray);

    // 배열 참조는 물론이고 내용도 변하지 않아야 한다.
    expect(inputArray).toHaveLength(snapshot.length);
    expect(inputArray[0]).toBe(snapshot[0]);
    expect(inputArray[1]).toBe(snapshot[1]);
  });

  /**
   * 케이스 7: 소수점 height 도 그대로 반환한다.
   *
   * 근거: 브라우저 레이아웃은 서브픽셀 단위를 반환할 수 있다(예: 24.5px).
   * 반올림 없이 원본 값을 보존해야 max 계산의 정밀도가 유지된다.
   */
  it('소수점 height 를 반올림하지 않고 그대로 반환한다', () => {
    const el = document.createElement('div');
    restoreQueue.push(stubHeight(el, 24.5).restore);

    const result = measureHeights([el]);

    expect(result).toEqual([24.5]);
  });

  /**
   * 케이스 8: 각 element 에 대해 getBoundingClientRect 를 정확히 한 번씩 호출한다.
   *
   * 근거: 성능 가드레일 — read-then-write 배칭에서 동일 element 를 두 번 읽으면
   * 불필요한 레이아웃 재계산이 발생한다.
   */
  it('각 element 의 getBoundingClientRect 를 정확히 한 번씩 호출한다', () => {
    const el0 = document.createElement('div');
    const el1 = document.createElement('div');

    const spy0 = rstest
      .spyOn(el0, 'getBoundingClientRect')
      .mockReturnValue({ height: 30 } as DOMRect);
    const spy1 = rstest
      .spyOn(el1, 'getBoundingClientRect')
      .mockReturnValue({ height: 50 } as DOMRect);

    restoreQueue.push(() => spy0.mockRestore());
    restoreQueue.push(() => spy1.mockRestore());

    measureHeights([el0, el1]);

    expect(spy0).toHaveBeenCalledOnce();
    expect(spy1).toHaveBeenCalledOnce();
  });
});
