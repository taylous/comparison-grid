import type { ReactNode } from 'react';

/**
 * TRow 가 객체면 그 string property 키, 아니면 never.
 * (scalar TRow 에서 프로토타입 메서드명이 키로 추론되는 것을 막는다.)
 */
type RowPropertyKey<TRow> = TRow extends object ? Extract<keyof TRow, string> : never;

/**
 * 하나의 열(column)을 기술하는 설정 객체.
 *
 * @typeParam TRow - grid 한 행의 데이터 타입.
 */
export interface ColumnDef<TRow> {
  /**
   * 열 식별자. grid 내에서 고유해야 한다.
   *
   * TRow 가 객체면 property 이름이 자동완성되며, 계산 컬럼 등 임의 문자열도 허용한다.
   * `string & {}` 는 리터럴 자동완성을 유지하기 위한 LiteralUnion 패턴이다.
   */
  key: RowPropertyKey<TRow> | (string & {});
  /** header 에 표시할 내용. 문자열 또는 렌더 함수. */
  displayText: string | (() => ReactNode);
  /** 한 행의 셀 내용을 렌더한다. */
  renderCell: (row: TRow) => ReactNode;
  /**
   * 아래로 같은 값이 연속되면 병합할지 여부. (기본 false)
   *
   * 병합 시 "같다"고 판단할 값은 {@link ColumnDef.getMergeValue} 로 정한다.
   */
  mergeable?: boolean;
  /**
   * 병합 시 "같다"고 판단할 비교 값. 같은 값이 아래로 연속되면 하나로 병합한다.
   *
   * 생략하면 `renderCell` 결과가 `string` 또는 `number` 일 때 그 값을 쓰고,
   * 그 외(예: JSX)면 비교 불가로 간주해 해당 열은 병합하지 않는다.
   */
  getMergeValue?: (row: TRow) => string | number;
  /** 열 너비(px). 가로 기하는 grid 가 책임진다. */
  width?: number;
  /** toggle 로 숨길 수 있는 열인지 여부. (기본 true) */
  hideable?: boolean;
}
