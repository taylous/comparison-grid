import { describe, it, expect } from '@rstest/core';
import { computeColumnMerges, type MergeRun, type ColumnDef } from '@entities/column';

// ---------------------------------------------------------------------------
// 테스트용 row 타입
// ---------------------------------------------------------------------------
interface Row {
  id: number;
  category: string;
  label: string;
  value: number;
}

// nullable value 필드가 있는 row 타입 (비원시 경계 분리 케이스용)
interface NullableRow {
  id: number;
  value: string | null;
}

// ---------------------------------------------------------------------------
// 헬퍼: ColumnDef 최소 생성
// ---------------------------------------------------------------------------
function makeColumn(
  overrides: Partial<ColumnDef<Row>> & Pick<ColumnDef<Row>, 'key'>,
): ColumnDef<Row> {
  return {
    displayText: overrides.key,
    renderCell: () => null,
    ...overrides,
  };
}

describe('computeColumnMerges', () => {
  // -------------------------------------------------------------------------
  // 케이스 1: 빈 rows
  // 요구사항: rows가 비어 있으면 비교할 셀이 없으므로 run이 생길 수 없다.
  // -------------------------------------------------------------------------
  it('빈 rows 배열을 전달하면 빈 배열을 반환한다', () => {
    const columns: ColumnDef<Row>[] = [
      makeColumn({ key: 'category', mergeable: true, renderCell: (r) => r.category }),
    ];

    const result = computeColumnMerges([], columns);

    expect(result).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // 케이스 2: 단일 row
  // 요구사항: MergeRun.span은 항상 2 이상. 1개 행은 run이 될 수 없다.
  // -------------------------------------------------------------------------
  it('row가 1개뿐이면 span >= 2인 run이 없으므로 빈 배열을 반환한다', () => {
    const columns: ColumnDef<Row>[] = [
      makeColumn({ key: 'category', mergeable: true, renderCell: (r) => r.category }),
    ];
    const rows: Row[] = [{ id: 1, category: 'A', label: 'x', value: 1 }];

    const result = computeColumnMerges(rows, columns);

    expect(result).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // 케이스 3: 전체가 동일한 값 → 하나의 run
  // 요구사항: 같은 값이 아래로 연속되면 하나로 병합. start: 0, span: rows.length.
  // -------------------------------------------------------------------------
  it('mergeable column의 모든 행 값이 같으면 전체를 포함하는 단일 run을 반환한다', () => {
    const rows: Row[] = [
      { id: 1, category: 'A', label: 'x', value: 1 },
      { id: 2, category: 'A', label: 'y', value: 2 },
      { id: 3, category: 'A', label: 'z', value: 3 },
    ];
    const columns: ColumnDef<Row>[] = [
      makeColumn({ key: 'category', mergeable: true, renderCell: (r) => r.category }),
    ];

    const result = computeColumnMerges(rows, columns);

    expect(result).toEqual<MergeRun[]>([{ columnKey: 'category', start: 0, span: 3 }]);
  });

  // -------------------------------------------------------------------------
  // 케이스 4: 값이 중간에 바뀜 → run이 끊기고 여러 run
  // 요구사항: "다른 데이터값이 나올때까지 병합". 각 run의 start/span이 정확해야 한다.
  // 예: A,A,B,B,B → run({start:0,span:2}), run({start:2,span:3})
  // -------------------------------------------------------------------------
  it('값이 중간에 바뀌면 run이 끊기며 각 run의 start와 span이 정확하다', () => {
    const rows: Row[] = [
      { id: 1, category: 'A', label: 'x', value: 1 },
      { id: 2, category: 'A', label: 'y', value: 2 },
      { id: 3, category: 'B', label: 'z', value: 3 },
      { id: 4, category: 'B', label: 'w', value: 4 },
      { id: 5, category: 'B', label: 'v', value: 5 },
    ];
    const columns: ColumnDef<Row>[] = [
      makeColumn({ key: 'category', mergeable: true, renderCell: (r) => r.category }),
    ];

    const result = computeColumnMerges(rows, columns);

    expect(result).toEqual<MergeRun[]>([
      { columnKey: 'category', start: 0, span: 2 },
      { columnKey: 'category', start: 2, span: 3 },
    ]);
  });

  // -------------------------------------------------------------------------
  // 케이스 5: 동일→다름→동일 패턴 → 분리된 run 두 개
  // 요구사항: 연속이 끊기면 새로운 run으로 시작. 떨어진 두 구간은 별개의 run.
  // A,A,B,A,A → run({start:0,span:2}), 'B'는 단독(run 아님), run({start:3,span:2})
  // -------------------------------------------------------------------------
  it('동일→다름→동일 패턴에서 두 개의 독립된 run이 생성된다', () => {
    const rows: Row[] = [
      { id: 1, category: 'A', label: 'x', value: 1 },
      { id: 2, category: 'A', label: 'y', value: 2 },
      { id: 3, category: 'B', label: 'z', value: 3 },
      { id: 4, category: 'A', label: 'w', value: 4 },
      { id: 5, category: 'A', label: 'v', value: 5 },
    ];
    const columns: ColumnDef<Row>[] = [
      makeColumn({ key: 'category', mergeable: true, renderCell: (r) => r.category }),
    ];

    const result = computeColumnMerges(rows, columns);

    expect(result).toEqual<MergeRun[]>([
      { columnKey: 'category', start: 0, span: 2 },
      { columnKey: 'category', start: 3, span: 2 },
    ]);
  });

  // -------------------------------------------------------------------------
  // 케이스 6-a: mergeable: false 인 column은 무시
  // 요구사항: "mergeable: true인 column만 병합 대상"
  // -------------------------------------------------------------------------
  it('mergeable: false인 column은 값이 모두 같아도 run을 생성하지 않는다', () => {
    const rows: Row[] = [
      { id: 1, category: 'A', label: 'x', value: 1 },
      { id: 2, category: 'A', label: 'y', value: 2 },
    ];
    const columns: ColumnDef<Row>[] = [
      makeColumn({ key: 'category', mergeable: false, renderCell: (r) => r.category }),
    ];

    const result = computeColumnMerges(rows, columns);

    expect(result).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // 케이스 6-b: mergeable 미지정(undefined)인 column은 무시
  // 요구사항: "기본 false". mergeable 필드 자체를 생략하면 병합 대상이 아니다.
  // -------------------------------------------------------------------------
  it('mergeable를 지정하지 않은 column은 값이 모두 같아도 run을 생성하지 않는다', () => {
    const rows: Row[] = [
      { id: 1, category: 'A', label: 'x', value: 1 },
      { id: 2, category: 'A', label: 'y', value: 2 },
    ];
    const columns: ColumnDef<Row>[] = [
      // mergeable 필드 생략
      makeColumn({ key: 'category', renderCell: (r) => r.category }),
    ];

    const result = computeColumnMerges(rows, columns);

    expect(result).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // 케이스 7: 불규칙 mergeable — 여러 column 중 일부만 mergeable
  // 요구사항: "병합 column 지정은 불규칙적일 수 있다" (requirements 기능 4).
  // non-mergeable column의 run이 없고, mergeable column의 columnKey가 정확해야 한다.
  // -------------------------------------------------------------------------
  it('여러 column 중 일부만 mergeable일 때 해당 column에 대해서만 run을 반환한다', () => {
    const rows: Row[] = [
      { id: 1, category: 'A', label: 'same', value: 1 },
      { id: 2, category: 'A', label: 'same', value: 2 },
      { id: 3, category: 'A', label: 'same', value: 3 },
    ];
    const columns: ColumnDef<Row>[] = [
      // category: mergeable — run이 생겨야 함
      makeColumn({ key: 'category', mergeable: true, renderCell: (r) => r.category }),
      // label: mergeable 아님 — 값이 전부 같아도 run 없음
      makeColumn({ key: 'label', mergeable: false, renderCell: (r) => r.label }),
      // value: mergeable 아님 — run 없음
      makeColumn({ key: 'value', renderCell: (r) => r.value }),
    ];

    const result = computeColumnMerges(rows, columns);

    // category에 대한 run만 존재해야 한다
    // label, value에 대한 run이 없어야 한다 (toEqual이 shape·값·길이를 모두 보장)
    expect(result).toEqual<MergeRun[]>([{ columnKey: 'category', start: 0, span: 3 }]);
  });

  // -------------------------------------------------------------------------
  // 케이스 8: getMergeValue 제공 시 그 값으로 병합
  // 요구사항: "getMergeValue가 있으면 그 값으로 비교". renderCell과 다른 기준으로 묶인다.
  // renderCell은 행마다 다른 값을 내지만, getMergeValue가 같은 그룹 키를 반환하면 병합돼야 한다.
  // -------------------------------------------------------------------------
  it('getMergeValue가 제공되면 renderCell이 아닌 getMergeValue 반환값으로 병합 여부를 판단한다', () => {
    const rows: Row[] = [
      { id: 1, category: 'A', label: 'apple', value: 100 },
      { id: 2, category: 'A', label: 'banana', value: 200 },  // renderCell과 다른 값
      { id: 3, category: 'B', label: 'cherry', value: 300 },
    ];
    const columns: ColumnDef<Row>[] = [
      makeColumn({
        key: 'label',
        mergeable: true,
        // renderCell은 행마다 다른 문자열을 반환하므로 renderCell 기준으론 병합 안 됨
        renderCell: (r) => r.label,
        // getMergeValue는 category를 기준으로 반환 → 앞 두 행이 병합돼야 함
        getMergeValue: (r) => r.category,
      }),
    ];

    const result = computeColumnMerges(rows, columns);

    expect(result).toEqual<MergeRun[]>([{ columnKey: 'label', start: 0, span: 2 }]);
  });

  // -------------------------------------------------------------------------
  // 케이스 9: getMergeValue 없고 renderCell이 string/number → 폴백 병합
  // 요구사항: "getMergeValue를 생략하면 renderCell 결과가 string|number일 때 폴백".
  // -------------------------------------------------------------------------
  it('getMergeValue가 없고 renderCell이 string을 반환하면 그 값으로 병합한다', () => {
    const rows: Row[] = [
      { id: 1, category: 'X', label: 'foo', value: 1 },
      { id: 2, category: 'X', label: 'foo', value: 2 },
      { id: 3, category: 'Y', label: 'bar', value: 3 },
    ];
    const columns: ColumnDef<Row>[] = [
      makeColumn({
        key: 'label',
        mergeable: true,
        renderCell: (r) => r.label, // string 반환 → 폴백 대상
        // getMergeValue 미제공
      }),
    ];

    const result = computeColumnMerges(rows, columns);

    expect(result).toEqual<MergeRun[]>([{ columnKey: 'label', start: 0, span: 2 }]);
  });

  it('getMergeValue가 없고 renderCell이 number를 반환하면 그 값으로 병합한다', () => {
    const rows: Row[] = [
      { id: 1, category: 'A', label: 'x', value: 42 },
      { id: 2, category: 'A', label: 'y', value: 42 },
      { id: 3, category: 'A', label: 'z', value: 99 },
    ];
    const columns: ColumnDef<Row>[] = [
      makeColumn({
        key: 'value',
        mergeable: true,
        renderCell: (r) => r.value, // number 반환 → 폴백 대상
      }),
    ];

    const result = computeColumnMerges(rows, columns);

    expect(result).toEqual<MergeRun[]>([{ columnKey: 'value', start: 0, span: 2 }]);
  });

  // -------------------------------------------------------------------------
  // 케이스 10: getMergeValue 없고 renderCell이 비원시값 → 병합 안 됨
  // 요구사항: "그 외(JSX 등 비원시값)면 비교 불가로 간주해 병합하지 않는다".
  // ReactNode 중 string|number가 아닌 값: null, boolean(true/false), undefined.
  // null을 반환하는 column — 모든 셀이 null이라도 병합되어선 안 된다.
  // WHY: icon-only 셀이나 빈 셀(null 반환)은 textContent가 없어도 병합되어선 안 된다는
  //      도메인 엣지 케이스. "icon만 있거나 textContent가 빈 셀은 전부 병합돼버리는 함정".
  // -------------------------------------------------------------------------
  it('getMergeValue가 없고 renderCell이 null을 반환하면 비교 불가로 보아 병합하지 않는다', () => {
    const rows: Row[] = [
      { id: 1, category: 'A', label: 'x', value: 1 },
      { id: 2, category: 'A', label: 'y', value: 2 },
      { id: 3, category: 'A', label: 'z', value: 3 },
    ];
    const columns: ColumnDef<Row>[] = [
      makeColumn({
        key: 'category',
        mergeable: true,
        // null은 ReactNode로 유효하지만 string|number가 아니므로 비교 불가
        renderCell: () => null,
      }),
    ];

    const result = computeColumnMerges(rows, columns);

    // null은 undefined로 처리되어 병합이 일어나지 않아야 한다
    expect(result).toEqual([]);
  });

  it('getMergeValue가 없고 renderCell이 true(boolean)를 반환하면 비교 불가로 보아 병합하지 않는다', () => {
    const rows: Row[] = [
      { id: 1, category: 'A', label: 'x', value: 1 },
      { id: 2, category: 'A', label: 'y', value: 2 },
    ];
    const columns: ColumnDef<Row>[] = [
      makeColumn({
        key: 'category',
        mergeable: true,
        // boolean은 ReactNode로 유효하지만 string|number가 아니므로 비교 불가
        renderCell: () => true,
      }),
    ];

    const result = computeColumnMerges(rows, columns);

    expect(result).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // 케이스 10-c: icon-only 셀 시뮬레이션 — getMergeValue 없이 배열 ReactNode 반환
  // WHY: ReactNode는 배열도 허용. 배열은 비원시값이므로 병합되어선 안 된다.
  //      실제 icon-only 셀을 완전히 시뮬레이트하진 못하지만, 비원시 ReactNode 경로를 검증한다.
  // NOTE: TypeScript 타입상 renderCell 반환이 ReactNode여야 하므로,
  //       [] (빈 배열)는 ReactNode[]로 유효하며 string|number가 아닌 케이스다.
  // -------------------------------------------------------------------------
  it('getMergeValue가 없고 renderCell이 배열(ReactNode[])을 반환하면 비교 불가로 보아 병합하지 않는다', () => {
    const rows: Row[] = [
      { id: 1, category: 'A', label: 'x', value: 1 },
      { id: 2, category: 'A', label: 'y', value: 2 },
    ];
    const columns: ColumnDef<Row>[] = [
      makeColumn({
        key: 'category',
        mergeable: true,
        // 빈 배열은 ReactNode로 유효하지만 string|number가 아니므로 비교 불가
        renderCell: () => [],
      }),
    ];

    const result = computeColumnMerges(rows, columns);

    expect(result).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // 케이스 11: 여러 mergeable column이 각각 독립적으로 run 생성
  // 요구사항: 각 column은 서로 독립적으로 병합된다. 출력에 두 column의 run이 모두 포함돼야 한다.
  // -------------------------------------------------------------------------
  it('여러 mergeable column이 각각 독립적으로 run을 생성하고 출력에 모두 포함된다', () => {
    const rows: Row[] = [
      { id: 1, category: 'A', label: 'foo', value: 1 },
      { id: 2, category: 'A', label: 'foo', value: 2 },
      { id: 3, category: 'B', label: 'bar', value: 3 },
    ];
    const columns: ColumnDef<Row>[] = [
      makeColumn({ key: 'category', mergeable: true, renderCell: (r) => r.category }),
      makeColumn({ key: 'label', mergeable: true, renderCell: (r) => r.label }),
    ];

    const result = computeColumnMerges(rows, columns);

    // category: {start:0, span:2}, label: {start:0, span:2} 모두 있어야 함
    const categoryRun = result.find((r) => r.columnKey === 'category');
    const labelRun = result.find((r) => r.columnKey === 'label');

    expect(categoryRun).toEqual<MergeRun>({ columnKey: 'category', start: 0, span: 2 });
    expect(labelRun).toEqual<MergeRun>({ columnKey: 'label', start: 0, span: 2 });
    expect(result).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // 추가 엣지 케이스: span이 정확히 1인 구간은 run에 포함되지 않는다
  // 요구사항: "span >= 2인 묶음만 반환한다 (단일 행은 run 아님)".
  // A,B,B,C → B,B만 run. A, C는 단독이므로 run 아님.
  // -------------------------------------------------------------------------
  it('연속 구간 중 span이 1인 구간은 run으로 포함하지 않는다', () => {
    const rows: Row[] = [
      { id: 1, category: 'A', label: 'x', value: 1 }, // 단독 → run 아님
      { id: 2, category: 'B', label: 'y', value: 2 }, // B 연속 시작
      { id: 3, category: 'B', label: 'z', value: 3 }, // B 연속 끝
      { id: 4, category: 'C', label: 'w', value: 4 }, // 단독 → run 아님
    ];
    const columns: ColumnDef<Row>[] = [
      makeColumn({ key: 'category', mergeable: true, renderCell: (r) => r.category }),
    ];

    const result = computeColumnMerges(rows, columns);

    expect(result).toEqual<MergeRun[]>([{ columnKey: 'category', start: 1, span: 2 }]);
  });

  // -------------------------------------------------------------------------
  // 추가 엣지 케이스: columns 배열 순서대로 run이 생성된다
  // WHY: 출력 순서가 columns 입력 순서와 일치해야 한다.
  //      소비자가 순서에 의존하는 경우를 대비해 검증한다.
  // -------------------------------------------------------------------------
  it('run은 columns 배열의 순서대로 생성된다', () => {
    const rows: Row[] = [
      { id: 1, category: 'A', label: 'foo', value: 1 },
      { id: 2, category: 'A', label: 'foo', value: 2 },
    ];
    // label을 category보다 앞에 배치
    const columns: ColumnDef<Row>[] = [
      makeColumn({ key: 'label', mergeable: true, renderCell: (r) => r.label }),
      makeColumn({ key: 'category', mergeable: true, renderCell: (r) => r.category }),
    ];

    const result = computeColumnMerges(rows, columns);

    expect(result[0]?.columnKey).toBe('label');
    expect(result[1]?.columnKey).toBe('category');
  });

  // -------------------------------------------------------------------------
  // 케이스 12: 비원시 행이 같은 값 구간 사이에 끼었을 때 경계 분리
  // 핵심 엣지 케이스: 비원시값(null 등) 행은 자기 자신이 병합되지 않을 뿐 아니라,
  // 양옆의 같은 값 구간을 서로 분리하는 경계 역할을 해야 한다.
  // WHY: renderCell 폴백 경로에서 null 반환은 undefined 로 처리되므로,
  //      앞뒤 'A' 구간이 undefined 를 사이에 두고 하나의 run 으로 합쳐져서는 안 된다.
  // -------------------------------------------------------------------------
  it('비원시 행(null 반환)이 같은 값 구간 사이에 끼면 양쪽 구간을 분리하는 경계가 된다', () => {
    // rows 렌더 시 값: ['A', 'A', (null→undefined), 'A', 'A']
    const rows: NullableRow[] = [
      { id: 1, value: 'A' },
      { id: 2, value: 'A' },
      { id: 3, value: null }, // renderCell이 null 반환 → 비원시 → undefined 처리
      { id: 4, value: 'A' },
      { id: 5, value: 'A' },
    ];
    const columns: ColumnDef<NullableRow>[] = [
      {
        key: 'value',
        displayText: 'value',
        mergeable: true,
        // getMergeValue 미제공 → renderCell 폴백 경로 사용
        renderCell: (r) => r.value, // string → 원시, null → 비원시
      },
    ];

    const result = computeColumnMerges(rows, columns);

    // 비원시 경계(index 2)가 앞뒤를 분리해야 한다:
    // - [0, 1] → { start: 0, span: 2 }
    // - index 2 (null) → run 없음
    // - [3, 4] → { start: 3, span: 2 }
    // 앞뒤 'A' 구간이 하나의 run (span 4 또는 5) 으로 합쳐지면 안 된다.
    expect(result).toEqual<MergeRun[]>([
      { columnKey: 'value', start: 0, span: 2 },
      { columnKey: 'value', start: 3, span: 2 },
    ]);
  });

  it('비원시 행이 없었다면 같은 값이 이어지는 전체 구간이 단일 run 하나로 합쳐진다 (경계 분리 효과 대조)', () => {
    // 위 케이스와 동일 데이터에서 null 행만 'A' 로 교체 → 경계가 사라짐
    const rows: NullableRow[] = [
      { id: 1, value: 'A' },
      { id: 2, value: 'A' },
      { id: 3, value: 'A' }, // 이제 원시값 'A' → 병합 대상
      { id: 4, value: 'A' },
      { id: 5, value: 'A' },
    ];
    const columns: ColumnDef<NullableRow>[] = [
      {
        key: 'value',
        displayText: 'value',
        mergeable: true,
        renderCell: (r) => r.value,
      },
    ];

    const result = computeColumnMerges(rows, columns);

    // 비원시 경계가 없으므로 전체 5행이 하나의 run 으로 합쳐져야 한다.
    expect(result).toEqual<MergeRun[]>([{ columnKey: 'value', start: 0, span: 5 }]);
  });

  // -------------------------------------------------------------------------
  // 추가 엣지 케이스: getMergeValue가 number를 반환하는 경우
  // 요구사항: getMergeValue 반환 타입은 string | number. number도 올바르게 비교돼야 한다.
  // -------------------------------------------------------------------------
  it('getMergeValue가 number를 반환할 때도 올바르게 병합한다', () => {
    const rows: Row[] = [
      { id: 1, category: 'A', label: 'x', value: 10 },
      { id: 2, category: 'B', label: 'y', value: 10 },
      { id: 3, category: 'C', label: 'z', value: 20 },
    ];
    const columns: ColumnDef<Row>[] = [
      makeColumn({
        key: 'category',
        mergeable: true,
        renderCell: (r) => r.category, // 다른 값
        getMergeValue: (r) => r.value,  // number 기준으로 앞 두 행이 같음
      }),
    ];

    const result = computeColumnMerges(rows, columns);

    expect(result).toEqual<MergeRun[]>([{ columnKey: 'category', start: 0, span: 2 }]);
  });
});
