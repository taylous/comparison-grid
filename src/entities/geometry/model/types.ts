export type GridId = string;

/**
 * grid 별 측정된 자연 높이 캐시. 배열 인덱스 `i` 는 행 `i` 에 대응한다.
 * 아직 측정되지 않은(화면 밖) 행은 `undefined` 로 비워 둔다.
 */
export type NaturalHeights = ReadonlyMap<GridId, ReadonlyArray<number | undefined>>;

/** 행 배치에 필요한 수직 기하. (requirements.md "행 높이 정책 > 소유권") */
export interface RowLayout {
  /** 각 행의 누적 시작 offset(px). `rowOffsets[i] = Σ rowHeights[0..i-1]` */
  rowOffsets: number[];
  /** 전체 높이(px). `Σ rowHeights` */
  totalHeight: number;
}
