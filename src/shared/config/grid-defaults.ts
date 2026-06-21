/**
 * 화면 밖(미측정) 행의 기본 추정 높이(px).
 *
 * 모든 grid 가 동일한 추정값을 사용해야 `totalHeight` 가 grid 간 어긋나지 않아
 * 스크롤 동기화가 유지된다. (requirements.md "행 높이 정책 > estimate")
 */
export const DEFAULT_CELL_HEIGHT = 20;
