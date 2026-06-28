/**
 * 주어진 엘리먼트들의 현재 높이(px)를 읽어 같은 순서로 반환한다. (읽기 전용)
 *
 * read-then-write 배칭의 **read 단계** 프리미티브: 모든 `getBoundingClientRect` 를 먼저 읽고,
 * 쓰기(높이 stretch)는 호출자가 그 뒤에 일괄 수행해 layout thrashing(강제 동기 reflow)을 피한다.
 * (requirements.md "성능 가드레일")
 */
export function measureHeights(elements: readonly Element[]): number[] {
  return elements.map((element) => element.getBoundingClientRect().height);
}
