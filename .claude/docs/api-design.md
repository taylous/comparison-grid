# Public API 설계 (계약)

> 이 문서는 ComparisonGrid 의 **public API 단일 기준**이다. Phase 1~5 구현은 이 계약을 따른다.
> 결정 일자: 2026-06-22. 변경 시 이 문서를 먼저 갱신하고 구현을 맞춘다.

## 확정된 입장

- **상태 제어: Hybrid** — 기본은 Uncontrolled(내부 상태), 필요한 상태만 optional 한 controlled props
  (`X` + `onXChange` + `defaultX`)로 연다. 제어 props 는 전부 optional 이라 "최소 public API" 원칙과 충돌하지 않는다.
- **row 타입: 제네릭 `TRow`** — `Grid<TRow>` + `ColumnDef<TRow>` 로 `renderCell(row)` 타입 안전성 확보.
- **컴포넌트: compound `Container` + `Grid`** — `<Container><Grid/><Grid/></Container>`
  (feature 11·12 의 "grid 를 children 으로 관리" 요구를 그대로 반영).

## Grid 단독 사용 (중요)

`Grid` 는 **`Container` 없이 단독으로도 사용할 수 있다.** (grid 가 1개만 필요한 경우)

- 따라서 가상화 on/off(`virtualized`)는 container 전역이 아니라 **grid 단위 prop** 이다.
- **수직 기하 소유권**:
  - `Container` 안에 있으면 → container 가 단일 소스(cross-grid max 등, requirements.md "행 높이 정책").
  - **단독**이면 → 그 grid 가 자기 수직 기하를 소유(cross-grid max 가 자기 자신뿐).
- 구현 함의: 수직 기하 엔진은 "grid 집합(1개 이상)"에 대해 동작하도록 설계하고, Container 는 그 집합을
  children 으로 채우는 오케스트레이터로 둔다. 단독 Grid 는 자기 1개짜리 집합으로 같은 엔진을 쓴다.

## 타입 계약

```ts
import type { ReactNode } from 'react';

// ── entities/column ──────────────────────────────
export interface ColumnDef<TRow> {
  key: string;
  displayText: string | (() => ReactNode); // feature 2
  renderCell: (row: TRow) => ReactNode; // feature 2
  /** feature 3,4: 아래로 같은 textContent 면 병합. column 단위 flag 이므로 불규칙 병합 허용. 기본 false. */
  mergeable?: boolean;
  /** 열 너비(px). 가로 기하는 grid 책임. */
  width?: number;
  /** feature 6 toggle 대상 여부. 기본 true. */
  hideable?: boolean;
}

// ── 비교 상태 (feature 13: row 전체 또는 선택 column, 불규칙 비교 불가) ──
export type ComparisonState =
  | null // off
  | { mode: 'row' }
  | { mode: 'column'; columnKeys: string[] };
```

## 컴포넌트 props

```ts
// ── widgets/Grid ─────────────────────────────────
export interface GridProps<TRow> {
  rows: TRow[];
  columns: ColumnDef<TRow>[];
  rowKey?: (row: TRow, index: number) => string | number;

  // column 표시/숨김 — Hybrid (feature 6)
  hiddenColumns?: string[]; // controlled (column key 목록)
  defaultHiddenColumns?: string[]; // uncontrolled 초기값
  onHiddenColumnsChange?: (keys: string[]) => void;

  // feature 9 가상화 on/off. 병합셀은 내부적으로 가상화에서 제외(feature 10).
  virtualized?: boolean;
}

// ── widgets/Container (compound: children = <Grid> 들) ──
export interface ContainerProps {
  children: ReactNode;

  // 스크롤 동기화는 항상 on (feature 12, 첫 grid 기준) → prop 으로 노출하지 않는다.

  // 하이라이트 모드 — Hybrid (feature 14)
  highlight?: boolean;
  defaultHighlight?: boolean;
  onHighlightChange?: (on: boolean) => void;

  // 비교 모드 — Hybrid (feature 13)
  comparison?: ComparisonState;
  defaultComparison?: ComparisonState;
  onComparisonChange?: (next: ComparisonState) => void;
}
```

## public export (최소)

`src/index.ts` 에서 export 하는 것만 public 이다.

- 컴포넌트: `Container`, `Grid`
- 타입: `ColumnDef`, `ComparisonState`, `GridProps`, `ContainerProps`

비공개(내부 구현): 측정/수직 기하 엔진, context, 내부 훅, slice 내부 모듈.

> 메모: 현재 임시로 export 중인 `DEFAULT_CELL_HEIGHT` 는 내부 상수로 강등(비공개)한다.
> widget 구현 시 `src/index.ts` 에서 제거한다.
