# 구현

## 기능

1. grid는 `n`개 생성될 수 있다.
2. grid `Cell`의 content는 사용자가 원하는 형태로 rendering 할 수 있다.
3. 어떤 grid의 특정 column의 content(textContent)가 `아래방향`으로 같다면 `병합`할 수 있다. (다른 데이터값이 나올때까지 병합)
4. 병할 column 지정은 `불규칙적`일 수 있다. (예로들어 5개의 열이 있는데 병합 column은 1,3,5 일 수도 있다)
5. grid엔 header가 존재한다.
6. grid header엔 toggle button을 추가하여 column을 숨길 수 있다. 숨기거나 나타날 땐 `fade-in, fade-out`같은 적절한 애니메이션을 적용해서 보여준다.
7. toggle button은 header의 가장자리 `왼쪽`, `오른쪽`에만 존재한다.
8. toggle button은 숨김처리 될 column 나타나든 없어지든 움직이지 않는다.
9. 가상화 리스트 기능을 제공한다.
10. merged cell(병합열)들은 가상화하지 않는다.
11. grid를 children으로 관리할 수 있는 `container` 제공한다.
12. `container`의 children으로 전달된 grid 들은 `스크롤 위치`를 공유한다. 어떤 grid에서 스크롤이 발생하든 모두가 똑같이 움직인다. (이 때는 **가장 첫번째 grid가 기준**이된다)
13. `container`의 children으로 전달된 grid 들은 cell content를 비교할 수 있는 기능이 주어진다. 비교는 `row(행)` content끼리 비교하거나 특정 ` column(열)`을 선택할 수 있다. 하지만 불규칙적으로 비교할 순 없다. (ex: grid의 1행 3열과 2행 1열만 비교 등)
14. `container`의 children으로 전달된 grid 들은 `하이라이트 모드`를 지원한다. 화면 전체가 `투명한 grey overlay`로 덮어지고 `n행에 mouse cursor를 over하면` **모든 grid의 n행 데이터만 overlay가 없어진다.**

## 추가설명

### 2. grid `Cell`의 content는 사용자가 원하는 형태로 rendering 할 수 있다.

column key를 기준으로 content를 rendering 하게 될 경우 아래의 예시 코드처럼 만들 수 있다.

```tsx
const columns = [
    {...},
    {...},
    {
        key: 'name',
        displayText: '이름',
        ...
        renderCell: (row: Row) => row.name,
        ...
    },
    {
        key: 'address',
        displayText: () => <AddressField />,
        ...
        renderCell: (row: Row) => <Field>{row.address}</Field>,
        ...
    }
]
```

---

## 행 높이 정책

행 높이는 **가변**이며, 모든 grid에서 같은 index의 행이 **같은 높이로 정렬**되어야 한다.

### 규칙

- 행 `i`의 높이 = **모든 grid의 행 `i` 셀 자연 높이 중 최댓값**.
  - 예: grid 3개의 2행 자연 높이가 `20 / 40 / 30`이면 → 2행은 모두 `40`.
- column toggle로 어느 grid의 자연 높이가 바뀌면 **재계산 후 전 grid에 전파**한다.
  - 예: 위 상태에서 grid2의 column을 펼쳐 grid2의 2행이 `50`이 되면 → 모든 grid의 2행은 `50`.

### 소유권 (single source of truth)

수직 기하는 개별 grid가 아니라 `container`가 소유한다. 개별 grid는 container가 계산한 값을 받아 배치만 한다.

```
naturalHeights: Map<gridId, number[]>      // grid별 측정값 캐시
rowHeights[i] = max( estimate, max over g ( naturalHeights[g][i] ) )  // estimate = 전역 floor
rowOffsets[i] = Σ rowHeights[0..i-1]
totalHeight   = Σ rowHeights
```

### 측정 범위

- 전체 행을 미리 측정하지 **않는다.**
- 스크롤이 동기화되어 모든 grid가 같은 행 index를 동시에 보여주므로, **현재 보이는 행만** 측정·정렬한다.
- 화면 밖 행은 estimate로 두고, 스크롤되어 보일 때 측정·보정한다.

### estimate (화면 밖 행 높이 추정 = 전역 최소 높이 floor)

- **고정 상수 `20`** (= default cell height)을 사용한다.
- estimate는 미측정 행의 추정값이자 **모든 행의 전역 최소 높이(floor)** 다. 측정값이 20보다 작은 행도 20으로 끌어올린다.
- **모든 grid가 동일한 estimate를 사용해야** totalHeight가 grid 간 어긋나지 않아 스크롤 동기화가 유지된다.
- 한계: 실제 자연 높이가 20보다 크면 화면 밖을 과소추정하여, 스크롤 시 measured 값으로 보정되며 스크롤바 thumb이 다소 점프할 수 있다. (v1 허용. 거슬리면 estimate를 "관측 행 높이의 러닝 평균"으로 교체 가능)

### 레이아웃 파이프라인 (순서 고정)

가변 높이는 너비에 의존하므로(텍스트 줄바꿈) 아래 순서를 반드시 지킨다.

1. **열 너비 확정** (어느 grid의 어느 column이 보이는지 포함)
2. **자연 높이 측정** (너비가 고정된 상태에서)
3. **cross-grid max → `rowHeights`**
4. **`rowOffsets` / `totalHeight` 계산**
5. **`transform`으로 배치**

### toggle 시 무효화 (무효화 범위 ≠ 전파 범위)

- grid2의 column을 토글하면 **grid2의 measurement만** 무효화한다. (그 column이 grid2 전 행에 걸치므로 grid2 캐시 전체 무효화)
- 다른 grid(grid1, grid3) 캐시는 **유지**한다.
- 재계산된 max는 **모든 grid의 배치에 전파**한다.
- offset 이동은 재측정이 아니라 **배열 재계산 + transform 갱신**이다. (다른 행을 다시 재지 않는다)

### 동적 콘텐츠 (ResizeObserver)

임의 `renderCell`은 mount 이후 높이가 변할 수 있다(이미지 로드, async 렌더). 이를 감지해 재측정한다.

- **측정/관찰 대상과 높이를 늘리는 대상을 반드시 분리**한다. (피드백 루프 방지)

```tsx
<div className="cell-box" style={{ height: rowHeights[i] }}>
  {" "}
  {/* max로 늘림. 관찰 X */}
  <div ref={observe} className="cell-content">
    {" "}
    {/* height: auto. 측정/관찰 대상 */}
    {renderCell(row)}
  </div>
</div>
```

- ResizeObserver는 **content wrapper만** 관찰한다. 발화 시: 해당 셀 `naturalHeights` 갱신 → cross-grid max 재계산 → 영향받은 행만 재배치.
- 같은 요소를 측정하면서 늘리면 `ResizeObserver loop limit exceeded`가 발생하므로 위 box/content 분리 구조를 어기지 않는다.

### 성능 가드레일

- **스크롤 중에는 절대 측정하지 않는다.** 측정은 mount / resize / toggle 시점에만. 스크롤은 캐시된 offset으로 `translate`만 한다.
- **read-then-write 배칭**: 모든 측정(`getBoundingClientRect`)을 먼저 읽고, 그 다음에 높이를 쓴다. 섞으면 layout thrashing(강제 동기 reflow).
- 측정은 content(`height: auto`)에서, stretch는 box에서만 한다.

### 애니메이션

`fade`와 `offset 이동`을 분리해 다룬다.

- **column fade in/out** (기능 6): `opacity` 전이. **공간은 유지**한다 (`display:none` 금지, `visibility`/`opacity`로). 매 프레임 가로 재계산 방지.
- **행 높이 변화로 인한 offset 이동: 애니메이트한다.** 단 아래 순서를 지킨다.
  1. 측정 · max · offset 재계산을 **먼저** 끝낸다. (이 단계는 애니메이션 없음)
  2. 확정된 새 offset으로 **`translateY`에만 transition**을 건다.
  3. transition 동안에는 ResizeObserver 측정을 **일시 중단/무시**한다.
- 원칙: **레이아웃 계산과 애니메이션을 같은 프레임에 섞지 않는다.** 먼저 목적지를 정하고, 그 다음 이동만 애니메이트한다.
