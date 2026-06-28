import type { RowLayout } from '../model/types';

/**
 * 행별 높이로부터 누적 offset과 전체 높이를 계산한다. (prefix sum)
 *
 * `rowOffsets[i] = Σ rowHeights[0..i-1]`, `totalHeight = Σ rowHeights`.
 * cell은 `transform: translateY(rowOffsets[i])` 로 배치하므로 offset이 단일 소스가 된다.
 * (requirements.md "레이아웃 파이프라인")
 */
export function computeRowLayout(rowHeights: readonly number[]): RowLayout {
  const rowOffsets = new Array<number>(rowHeights.length);

  let acc = 0;
  for (let i = 0; i < rowHeights.length; i++) {
    rowOffsets[i] = acc;
    acc += rowHeights[i]!;
  }

  return { rowOffsets, totalHeight: acc };
}
