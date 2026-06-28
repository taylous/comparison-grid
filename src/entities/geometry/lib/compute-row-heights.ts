import type { NaturalHeights } from '../model/types';

/**
 * 모든 grid의 자연 높이를 cross-grid max로 합쳐 행별 높이를 계산한다.
 *
 * 행 `i` 높이 = 모든 grid의 행 `i` 자연 높이 중 최댓값. (requirements.md "행 높이 정책")
 * 같은 index의 행은 모든 grid에서 같은 높이로 정렬되어야 하므로 단일 소스로 계산한다.
 *
 * `estimate` 는 **전역 최소 높이(floor)** 로 쓴다. 미측정 행/grid는 물론, 측정값이
 * estimate보다 작은 행도 estimate로 끌어올린다. 모든 grid가 동일한 floor를 공유해야
 * `totalHeight` 가 grid 간 어긋나지 않아 스크롤 동기화가 유지된다.
 *
 * @param naturalHeights grid별 측정 높이 캐시 (미측정 행은 `undefined`)
 * @param rowCount 전체 행 개수 (모든 grid가 공유)
 * @param estimate 미측정·과소 행에 적용할 최소 높이(px)
 */
export function computeRowHeights(
  naturalHeights: NaturalHeights,
  rowCount: number,
  estimate: number,
): number[] {
  // floor(estimate)로 시작 → 측정값으로 max를 올린다.
  // floor가 미측정 grid의 `?? estimate` 항과 estimate 미만 측정값을 한 번에 흡수한다.
  const rowHeights = new Array<number>(rowCount).fill(estimate);

  for (const heights of naturalHeights.values()) {
    for (let i = 0; i < rowCount; i++) {
      const height = heights[i];
      if (height !== undefined && height > rowHeights[i]!) {
        rowHeights[i] = height;
      }
    }
  }

  return rowHeights;
}
