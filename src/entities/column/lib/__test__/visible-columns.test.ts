import { describe, it, expect } from '@rstest/core';
import { getVisibleColumns, type ColumnDef } from '@entities/column';

// ---------------------------------------------------------------------------
// 테스트용 row 타입 (단순 레코드로 충분)
// ---------------------------------------------------------------------------
interface Row {
  id: number;
  name: string;
  price: number;
  stock: number;
}

// ---------------------------------------------------------------------------
// 헬퍼: ColumnDef 최소 생성 (displayText, renderCell은 테스트와 무관)
// ---------------------------------------------------------------------------
function makeColumn(key: keyof Row & string): ColumnDef<Row> {
  return {
    key,
    displayText: key,
    renderCell: () => null,
  };
}

describe('getVisibleColumns', () => {
  // -------------------------------------------------------------------------
  // 케이스 1: hiddenColumnKeys가 빈 배열 → 입력과 동일 (동일 참조 반환)
  // 요구사항: 숨길 키가 없으면 필터링이 불필요하므로 입력 배열을 그대로 반환해야 한다.
  // 동일 참조(identity)를 검증해 불필요한 배열 복사가 없음을 확인한다.
  // WHY: 소비자가 참조 안정성(memo 등)에 의존할 수 있다.
  //      column toggle 없는 상태에서 매 render마다 새 배열을 만들면 낭비.
  // -------------------------------------------------------------------------
  it('hiddenColumnKeys가 빈 배열이면 입력 배열과 동일한 참조를 반환한다', () => {
    const columns: ColumnDef<Row>[] = [
      makeColumn('id'),
      makeColumn('name'),
      makeColumn('price'),
    ];

    const result = getVisibleColumns(columns, []);

    // 동일 참조(same reference) 검증
    expect(result).toBe(columns);
  });

  // -------------------------------------------------------------------------
  // 케이스 2: 일부 key 숨김 → 해당 column 제외, 순서 유지
  // 요구사항: 숨김 키 목록을 제외하고 원래 순서대로 반환.
  // 순서가 바뀌면 grid 렌더링 순서가 달라지므로 반드시 검증해야 한다.
  // -------------------------------------------------------------------------
  it('일부 key를 숨기면 해당 column만 제외되고 나머지 순서가 유지된다', () => {
    const id = makeColumn('id');
    const name = makeColumn('name');
    const price = makeColumn('price');
    const stock = makeColumn('stock');
    const columns: ColumnDef<Row>[] = [id, name, price, stock];

    const result = getVisibleColumns(columns, ['name', 'stock']);

    // 'id'와 'price'만 남고, 원래 순서(id → price) 유지
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(id);
    expect(result[1]).toBe(price);
  });

  it('첫 번째 column만 숨기면 나머지가 원래 순서 그대로 반환된다', () => {
    const columns: ColumnDef<Row>[] = [
      makeColumn('id'),
      makeColumn('name'),
      makeColumn('price'),
    ];

    const result = getVisibleColumns(columns, ['id']);

    expect(result.map((c) => c.key)).toEqual(['name', 'price']);
  });

  it('마지막 column만 숨기면 나머지가 원래 순서 그대로 반환된다', () => {
    const columns: ColumnDef<Row>[] = [
      makeColumn('id'),
      makeColumn('name'),
      makeColumn('price'),
    ];

    const result = getVisibleColumns(columns, ['price']);

    expect(result.map((c) => c.key)).toEqual(['id', 'name']);
  });

  // -------------------------------------------------------------------------
  // 케이스 3: 전부 숨김 → 빈 배열
  // 요구사항: 모든 column이 숨겨지면 보이는 column이 없으므로 빈 배열이어야 한다.
  // -------------------------------------------------------------------------
  it('모든 key를 숨기면 빈 배열을 반환한다', () => {
    const columns: ColumnDef<Row>[] = [
      makeColumn('id'),
      makeColumn('name'),
      makeColumn('price'),
    ];

    const result = getVisibleColumns(columns, ['id', 'name', 'price']);

    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // 케이스 4: 존재하지 않는 key 숨김 → 변화 없음
  // 요구사항: hidden 목록에 없는 key가 들어와도 기존 columns에 영향이 없어야 한다.
  // WHY: 잘못된 key를 에러 대신 조용히 무시해야 안전하다. column이 제거·이름변경된
  //      뒤 오래된 hidden 상태가 남아있을 수 있는 시나리오.
  // -------------------------------------------------------------------------
  it('hidden 목록에 존재하지 않는 key가 있어도 반환 결과에 변화가 없다', () => {
    const columns: ColumnDef<Row>[] = [
      makeColumn('id'),
      makeColumn('name'),
      makeColumn('price'),
    ];

    const result = getVisibleColumns(columns, ['nonExistentKey', 'anotherMissingKey']);

    expect(result.map((c) => c.key)).toEqual(['id', 'name', 'price']);
    expect(result).toHaveLength(3);
  });

  // -------------------------------------------------------------------------
  // 케이스 5: hidden 목록에 중복 key가 있어도 정상 동작
  // 요구사항: hiddenColumnKeys를 Set으로 변환하므로 중복이 있어도 올바르게 처리된다.
  // WHY: UI에서 toggle 이벤트가 중복 발생하거나, 소비자가 배열을 직접 구성할 때
  //      실수로 같은 key를 두 번 넣는 경우를 방어해야 한다.
  // -------------------------------------------------------------------------
  it('hidden 목록에 같은 key가 중복으로 들어와도 해당 column을 한 번만 제거한다', () => {
    const columns: ColumnDef<Row>[] = [
      makeColumn('id'),
      makeColumn('name'),
      makeColumn('price'),
    ];

    // 'name'이 두 번 들어간 경우
    const result = getVisibleColumns(columns, ['name', 'name']);

    // 'name'만 제거되고 'id', 'price'는 그대로 있어야 한다
    expect(result.map((c) => c.key)).toEqual(['id', 'price']);
    expect(result).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // 추가 엣지 케이스: columns 배열이 비어 있을 때
  // WHY: 초기 상태나 모든 column이 제거된 edge 상황에서 안전해야 한다.
  // -------------------------------------------------------------------------
  it('columns 배열이 비어 있으면 hiddenColumnKeys에 관계없이 빈 배열을 반환한다', () => {
    const result = getVisibleColumns([], ['id', 'name']);

    expect(result).toEqual([]);
  });

  it('columns 배열이 비어 있고 hiddenColumnKeys도 빈 배열이면 빈 배열을 반환한다', () => {
    const result = getVisibleColumns<Row>([], []);

    expect(result).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // 추가 엣지 케이스: 반환된 배열의 각 원소가 원본 ColumnDef 참조와 동일
  // WHY: getVisibleColumns는 column 객체를 복사하지 않아야 한다.
  //      소비자가 column 참조를 Map key 등으로 사용할 수 있다.
  // -------------------------------------------------------------------------
  it('반환된 column 객체는 원본 ColumnDef 객체와 동일한 참조다', () => {
    const id = makeColumn('id');
    const name = makeColumn('name');
    const price = makeColumn('price');
    const columns: ColumnDef<Row>[] = [id, name, price];

    const result = getVisibleColumns(columns, ['name']);

    expect(result[0]).toBe(id);
    expect(result[1]).toBe(price);
  });

  // -------------------------------------------------------------------------
  // 추가 엣지 케이스: hiddenColumnKeys가 readonly 배열이어도 정상 동작
  // WHY: 함수 시그니처가 `readonly string[]`를 받으므로, 소비자가 as const 등으로
  //      읽기 전용 배열을 넘기는 경우를 커버한다.
  // -------------------------------------------------------------------------
  it('hiddenColumnKeys가 readonly 배열(as const)이어도 정상 동작한다', () => {
    const columns: ColumnDef<Row>[] = [
      makeColumn('id'),
      makeColumn('name'),
      makeColumn('price'),
    ];
    const hidden = ['name'] as const;

    const result = getVisibleColumns(columns, hidden);

    expect(result.map((c) => c.key)).toEqual(['id', 'price']);
  });
});
