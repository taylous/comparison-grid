import type { ColumnDef } from '../model/column';

/**
 * 숨김 키 목록을 제외한 보이는 열만 원래 순서대로 반환한다.
 */
export function getVisibleColumns<TRow>(
  columns: ColumnDef<TRow>[],
  hiddenColumnKeys: readonly string[],
): ColumnDef<TRow>[] {
  if (hiddenColumnKeys.length === 0) {
    return columns;
  }
  const hidden = new Set(hiddenColumnKeys);
  return columns.filter((column) => !hidden.has(column.key));
}
