# 테스트 지침

테스트는 `rspack` 진영의 `rstest`를 사용합니다.

> 만약 구축 중 문제가 발생하면 `vitest`로 전환합니다.

## 진행할 테스트

1. unit test (coverage 포함)
2. component test (storybook으로 구현)
3. E2E test (브라우저 상호작용·시각 회귀 중심)

### E2E 주요 시나리오

순수 UI 라이브러리이므로 서버 모킹(msw)은 사용하지 않는다. 대신 실제 상호작용을 검증한다.

- 스크롤 동기화: 한 grid를 스크롤하면 전 grid가 함께 움직이는가 (기준 = 첫 번째 grid)
- 행 높이 동기화: 같은 index 행이 모든 grid에서 같은 높이로 정렬되는가
- column toggle: 토글 시 행 높이 재계산·전파, fade, offset 이동 애니메이션
- 하이라이트 모드: hover 시 모든 grid의 해당 행 overlay 해제

## 테스트 작성·검증 워크플로 (작성/검증 분리)

신뢰성·정합성을 위해 **테스트 작성과 검증을 분리**한다. 권한 레벨로 역할을 강제한다.

- **test-writer**: 테스트를 작성만 한다. 실행 권한(Bash) 없음 → 통과시키려 조정 불가.
- **test-verifier**: 테스트를 실행·평가만 한다. 수정 권한(Write/Edit) 없음 → 고쳐서 통과시키기 불가. requirements.md 기준으로 **독립 판단**한다.

> 위 두 역할은 Claude Code sub-agent로 구현한다. (`.claude/agents/test-writer.md`, `.claude/agents/test-verifier.md`)
> sub-agent는 메인 대화 맥락을 받지 못하므로, "왜 이 테스트가 필요한지" 같은 rationale 주석/문서는 메인 에이전트가 작성한다.
