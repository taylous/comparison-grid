# ComparisonGrid

## 1. 프로젝트 개요

같은 같은 주제의 데이터를 Grid로 정렬·비교할 수 있는 라이브러리입니다.
여러 grid를 container로 묶어 스크롤·행 높이·하이라이트를 동기화하는 것이 핵심입니다.

## 2. 사용할 주요 패키지

필요할 때 아래에서 참조합니다.
`./.claude/docs/environments.md`

## 3. 구현할 기능

기능 명세는 필요할 때 아래에서 참조합니다.
`./.claude/docs/requirements.md`

### 핵심 제약 (rendering)

- `Row`는 `n`개의 `Cell`로 구성되며, `Cell`의 container 역할을 한다.
- `Cell`은 `position: absolute + transform`으로 배치한다. (reflow 회피, GPU 합성)
- 병합셀은 `row span`을 쓰지 않고, 병합 대상 cell들의 개수·크기를 계산한 **하나의 큰 `Cell`로 덮는다.**
- 가상화 리스트를 제공하며 사용자가 on/off 선택할 수 있다. 단, **병합셀은 가상화하지 않는다.**
- **수직 기하(행 높이·offset·전체 높이)는 개별 grid가 아니라 `container`가 단일 소스로 소유한다.** 개별 grid는 자기 열(가로)만 책임진다. (상세: requirements.md "행 높이 정책")

### 핵심 제약 (라이브러리 계약)

- public API는 최소로 유지한다. 내부 구현(slice 내부 모듈, 측정 로직 등)은 export 하지 않는다.
- column은 `{ key, displayText, renderCell, ... }` 설정 객체로 받는다. (예시: requirements.md)
- tree-shaking이 가능하도록 side-effect를 피하고 named export를 기본으로 한다.
- Controlled / Uncontrolled 입장은 API 확정 시 결정한다. **(TODO: 결정 후 여기 명시)**

## 4. 디자인 패턴

`FSD pattern`으로 개발합니다.

> 참조: https://fsd.how/

layer의 종류와 이름은 아래와 같이 지정합니다.

- Widgets: widgets
- Features: features
- Entities: entities
- Shared: shared

> 라이브러리이므로 `app`, `pages` 레이어는 **의도적으로 생략**한다. (만들지 않는다)

### layer 내부 공유 slice

FSD pattern의 normal한 규칙으로는 layer 내부의 slice간 file, variable, function 등의 공유는 허용되지 않습니다.

하지만 개발할 때 어쩔 수 없이 **같은 layer에서 공유해야할 순간**이 온다면 **아래의 절차대로 검토 후 결정**합니다.

1. 하위 layer로 이동 (ex: entities에서 shared로)
2. (해당 규칙이 [fsd.how](https://fsd.how/)보다 우선한다) layer 내부에 `_` prefix를 붙여서 공유 slice를 생성 (ex: entities/\_common)

> 위의 시나리오가 발생하면 검토 결과를 사용자에게 공유하고 결정하게함

## 5. 테스트 및 문서화 지침

`테스팅 환경을 구축할 때` 아래의 위치에서 정보를 참조합니다.
`./.claude/docs/testing.md`

1. `test coverage`는 최소 `80%` 이상을 cover 한다.
2. component는 `storybook`으로 사용자가 확인할 수 있도록 작성한다.
3. 불필요하다고 판단되는 테스트는 **이유를 사용자에게 알리고 결정하게 한다.**
4. 공개 API의 TSDoc 주석을 토대로 storybook docs를 만든다.
5. 테스트 작성·검증 워크플로(작성/검증 분리)는 testing.md를 따른다.

## 6. Code Convention

1. 포맷·문법 규칙(조건문 bracket, 최신 ES 문법 등)은 **eslint·prettier·tsconfig로 강제**한다. CLAUDE.md에 중복 명시하지 않는다.
2. 주석은 **WHY**(자명하지 않은 결정의 이유)와 **공개 API(TSDoc)**에 집중한다. 모든 변수·함수에 달지 않으며, 자명한 코드엔 생략한다.
3. 주석 작성이 애매하면 사용자에게 결정하도록 한다.

## 7. 개발 지침

LLM 코딩 실수를 줄이기 위한 행동 지침. 사소한 작업은 판단껏.

- **가정 금지.** 가정은 명시하고 불확실하면 묻는다. 해석이 여럿이면 임의로 고르지 말고 제시한다. 불명확하면 멈추고 무엇이 모호한지 말한다.
- **단순함 우선.** 요청된 것만 만든다. 추측성 기능·단일 사용 추상화·요청되지 않은 유연성·불가능 시나리오 에러 처리는 금지.
- **외과적 변경.** 무관한 코드·포맷·주석을 "개선"하지 않는다. 멀쩡한 것을 리팩터링하지 않는다. 기존 스타일을 따른다. 내 변경이 만든 orphan만 정리하고, 무관한 dead code는 삭제하지 말고 언급만 한다.
- **목표 주도 실행.** 작업을 "검증 가능한 성공 기준"으로 바꾼다 (예: "버그 수정" → "재현 테스트 작성 후 통과"). 멀티스텝은 단계별 verify를 명시한다.
