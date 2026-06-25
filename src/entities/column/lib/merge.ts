import type { ColumnDef } from '../model/column';

/** 한 열에서 아래로 병합된 셀 묶음. */
export interface MergeRun {
  /** 병합된 열의 key. */
  columnKey: string;
  /** 병합 시작 row index (inclusive). */
  start: number;
  /** 병합된 row 개수. 항상 2 이상. */
  span: number;
}

/**
 * 병합 시 "같다"고 판단할 비교 값을 구한다. 비교 불가면 `undefined`.
 *
 * WHY: `renderCell` 이 JSX 를 반환하면 DOM textContent 비교가 불안정하므로,
 * 데이터 기반(`getMergeValue`)을 우선하고 원시값일 때만 `renderCell` 결과로 폴백한다.
 */
function mergeValueOf<TRow>(column: ColumnDef<TRow>, row: TRow): string | number | undefined {
  if (column.getMergeValue) {
    return column.getMergeValue(row);
  }
  const rendered = column.renderCell(row);
  if (typeof rendered === 'string' || typeof rendered === 'number') {
    return rendered;
  }
  return undefined;
}

/**
 * 각 mergeable 열에 대해, 아래로 같은 값이 연속되는 구간을 병합 묶음으로 계산한다.
 *
 * 병합 셀의 "크기(높이)"는 rowHeights 에 의존하므로 여기서 계산하지 않는다. (기하 단계로 분리)
 */
export function computeColumnMerges<TRow>(
  rows: TRow[],
  columns: ColumnDef<TRow>[],
): MergeRun[] {
  const runs: MergeRun[] = [];

  for (const column of columns) {
    if (!column.mergeable) {
      continue;
    }

    const values = rows.map((row) => mergeValueOf(column, row));
    let start = 0;
    while (start < values.length) {
      const value = values[start];
      let end = start + 1;
      // 비교 불가(undefined)면 묶지 않는다.
      if (value !== undefined) {
        while (end < values.length && values[end] === value) {
          end += 1;
        }
      }
      const span = end - start;
      if (span >= 2) {
        runs.push({ columnKey: column.key, start, span });
      }
      start = end;
    }
  }

  return runs;
}
