/**
 * computeRowLayout 단위 테스트
 *
 * 근거: requirements.md "행 높이 정책 > 레이아웃 파이프라인"
 * - rowOffsets[i] = Σ rowHeights[0..i-1] (prefix sum)
 * - totalHeight = Σ rowHeights
 * - Cell은 transform: translateY(rowOffsets[i])로 배치하므로 offset이 단일 소스가 된다.
 * - 이 함수는 computeRowHeights의 결과를 받아 배치 좌표를 생성하는 파이프라인 4단계다.
 */
import { describe, it, expect } from '@rstest/core';
import { computeRowLayout } from '@entities/geometry';
import type { RowLayout } from '@entities/geometry';

describe('computeRowLayout', () => {
  // -------------------------------------------------------------------------
  // 케이스 1: 빈 배열 → { rowOffsets: [], totalHeight: 0 }
  // 요구사항: 행이 없으면 offset 배열도 없고 전체 높이도 0이어야 한다.
  // WHY: 가상화 뷰에서 보이는 행이 없거나 rowCount=0인 경우를 안전하게 처리해야 한다.
  // -------------------------------------------------------------------------
  it('빈 배열을 전달하면 { rowOffsets: [], totalHeight: 0 }을 반환한다', () => {
    const result = computeRowLayout([]);

    expect(result).toEqual<RowLayout>({ rowOffsets: [], totalHeight: 0 });
  });

  // -------------------------------------------------------------------------
  // 케이스 2: 단일 행 → rowOffsets = [0], totalHeight = 해당 행 높이
  // 요구사항: 첫 번째 행의 offset은 항상 0이다 (이전 행이 없으므로 누적합 = 0).
  // -------------------------------------------------------------------------
  it('단일 행이면 rowOffsets는 [0]이고 totalHeight는 해당 행 높이이다', () => {
    const result = computeRowLayout([40]);

    expect(result).toEqual<RowLayout>({ rowOffsets: [0], totalHeight: 40 });
  });

  // -------------------------------------------------------------------------
  // 케이스 3: rowOffsets[0] === 0 (항상)
  // 요구사항: "rowOffsets[i] = Σ rowHeights[0..i-1]". i=0이면 빈 합(0)이다.
  // WHY: 첫 번째 행은 translateY(0)으로 배치되어야 한다.
  //      이 값이 0이 아니면 첫 행이 잘못된 위치에 배치된다.
  // -------------------------------------------------------------------------
  it('rowOffsets[0]은 행이 여러 개여도 항상 0이다', () => {
    const result = computeRowLayout([40, 30, 20]);

    // [40, 30, 20] → offsets = [0, 40, 70]
    expect(result.rowOffsets).toEqual([0, 40, 70]);
  });

  // -------------------------------------------------------------------------
  // 케이스 4: rowOffsets[i] = 이전 행 높이들의 누적합
  // 요구사항: prefix sum 공식이 정확해야 Cell이 올바른 위치에 translateY로 배치된다.
  // -------------------------------------------------------------------------
  it('rowOffsets[i]는 앞선 모든 행 높이의 누적합이다', () => {
    // [20, 30, 40]
    // offsets[0] = 0          (이전 행 없음)
    // offsets[1] = 20         (= rowHeights[0])
    // offsets[2] = 20 + 30    (= rowHeights[0] + rowHeights[1])
    const result = computeRowLayout([20, 30, 40]);

    expect(result.rowOffsets).toEqual([0, 20, 50]);
  });

  // -------------------------------------------------------------------------
  // 케이스 5: totalHeight = 모든 rowHeights의 합
  // 요구사항: "totalHeight = Σ rowHeights". 스크롤 컨테이너의 scrollHeight 기준이 된다.
  // WHY: totalHeight가 틀리면 스크롤바 비율이 어긋나 동기화가 깨진다.
  // -------------------------------------------------------------------------
  it('totalHeight는 모든 행 높이의 합이다', () => {
    const result = computeRowLayout([20, 30, 40]);

    expect(result.totalHeight).toBe(90);
  });

  // -------------------------------------------------------------------------
  // 케이스 6: 0 높이 행이 섞인 경우
  // WHY: display:none이나 height:0인 행(collapsed 등)이 섞여도 누적합이 올바르게
  //      계산되어야 한다. 0 높이 행 다음 행의 offset이 같은 값이 되는 것이 정상이다.
  // -------------------------------------------------------------------------
  it('높이가 0인 행이 섞여 있어도 누적합이 올바르게 계산된다', () => {
    // [0, 30, 0, 40]
    // offsets[0] = 0
    // offsets[1] = 0          (rowHeights[0] = 0)
    // offsets[2] = 0 + 30     (rowHeights[0] + rowHeights[1])
    // offsets[3] = 0 + 30 + 0 (rowHeights[0] + rowHeights[1] + rowHeights[2])
    const result = computeRowLayout([0, 30, 0, 40]);

    expect(result.rowOffsets).toEqual([0, 0, 30, 30]);
    expect(result.totalHeight).toBe(70);
  });

  // -------------------------------------------------------------------------
  // 케이스 7: 반환 rowOffsets의 길이 === 입력 rowHeights의 길이
  // 요구사항: rowOffsets[i]와 rowHeights[i]가 1:1 대응이어야 인덱스 기반 접근이 안전하다.
  // -------------------------------------------------------------------------
  it('반환 rowOffsets의 길이는 입력 rowHeights의 길이와 같다', () => {
    const result = computeRowLayout([10, 20, 30]);

    expect(result.rowOffsets).toHaveLength(3);
  });

  // -------------------------------------------------------------------------
  // 케이스 8: 5개 행 prefix sum 전체 검증
  // 요구사항: 공식 rowOffsets[i] = Σ rowHeights[0..i-1]이 모든 인덱스에서 성립해야 한다.
  // -------------------------------------------------------------------------
  it('5개 행의 rowOffsets와 totalHeight가 prefix sum 공식과 일치한다', () => {
    // [10, 20, 30, 40, 50]
    // offsets = [0, 10, 30, 60, 100]
    // total   = 150
    const result = computeRowLayout([10, 20, 30, 40, 50]);

    expect(result.rowOffsets).toEqual([0, 10, 30, 60, 100]);
    expect(result.totalHeight).toBe(150);
  });

  // -------------------------------------------------------------------------
  // 케이스 9: 모든 행의 높이가 같을 때
  // WHY: 등간격 행 레이아웃(예: 기본 estimate로만 채워진 경우)이 가장 흔한 초기 상태.
  //      uniform heights에서 공식이 올바른지 확인한다.
  // -------------------------------------------------------------------------
  it('모든 행의 높이가 같을 때 누적합이 등차수열을 이룬다', () => {
    // [20, 20, 20] → offsets = [0, 20, 40], total = 60
    const result = computeRowLayout([20, 20, 20]);

    expect(result.rowOffsets).toEqual([0, 20, 40]);
    expect(result.totalHeight).toBe(60);
  });

  // -------------------------------------------------------------------------
  // 케이스 10: 소수점 높이 (sub-pixel)
  // WHY: 브라우저 레이아웃은 서브픽셀 단위를 반환할 수 있다(예: 24.5px).
  //      computeRowHeights 결과가 소수일 수 있으므로 computeRowLayout도 이를 다룰 수 있어야 한다.
  // -------------------------------------------------------------------------
  it('소수점 높이가 포함되어 있어도 누적합을 올바르게 계산한다', () => {
    // [24.5, 36.25] → offsets = [0, 24.5], total = 60.75
    const result = computeRowLayout([24.5, 36.25]);

    expect(result.rowOffsets).toEqual([0, 24.5]);
    expect(result.totalHeight).toBeCloseTo(60.75);
  });

  // -------------------------------------------------------------------------
  // 케이스 11: 입력 rowHeights를 변형하지 않는다 (순수성)
  // 요구사항: 순수 함수. 입력 배열을 변형하지 않는다.
  // WHY: computeRowLayout은 pipeline 단계 중 하나이므로 이전 단계의 결과를
  //      오염시키지 않아야 한다.
  // -------------------------------------------------------------------------
  it('입력 rowHeights 배열을 변형하지 않는다', () => {
    const input = [20, 30, 40];
    const snapshot = [...input];

    computeRowLayout(input);

    expect(input).toEqual(snapshot);
    expect(input).toHaveLength(snapshot.length);
  });

  // -------------------------------------------------------------------------
  // 케이스 12: RowLayout 반환 객체가 rowOffsets와 totalHeight 두 필드를 모두 가진다
  // 요구사항: RowLayout 타입 계약 { rowOffsets: number[]; totalHeight: number }.
  // -------------------------------------------------------------------------
  it('반환 객체는 rowOffsets와 totalHeight 두 필드를 모두 포함한다', () => {
    const result = computeRowLayout([30, 50]);

    expect(result).toHaveProperty('rowOffsets');
    expect(result).toHaveProperty('totalHeight');
  });
});
