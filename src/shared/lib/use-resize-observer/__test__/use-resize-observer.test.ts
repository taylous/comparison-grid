/**
 * useResizeObserver 단위 테스트
 *
 * 근거: requirements.md "동적 콘텐츠 (ResizeObserver)" 및 "성능 가드레일"
 * - content wrapper 만 관찰하고, 측정 대상과 stretch 대상을 분리한다.
 * - mount / resize / toggle 시점에만 측정한다. 스크롤 중에는 측정하지 않는다.
 * - observer 를 재생성하지 않고 최신 콜백을 유지하는 callbackRef 패턴을 사용한다.
 * - ResizeObserver 미지원 환경(SSR 등)에서는 noop 처리한다.
 *
 * jsdom 에는 ResizeObserver 가 없으므로 global.ResizeObserver 를 직접 mock 한다.
 * mock 클래스는 생성자에 전달된 콜백을 캡처해 테스트에서 수동으로 발화시킨다.
 */
import { describe, it, expect, beforeEach, afterEach } from '@rstest/core';
import { rstest } from '@rstest/core';
import { renderHook, act } from '@testing-library/react';
import { useResizeObserver } from '@shared/lib';
import type { ResizeCallback } from '@shared/lib';

// ── Mock ResizeObserver 인프라 ─────────────────────────────────────────────

/** 테스트에서 수동으로 발화시킬 수 있도록 콜백을 저장한다. */
type ResizeObserverCallback = (
  entries: ResizeObserverEntry[],
  observer: ResizeObserver,
) => void;

interface MockResizeObserverInstance {
  observe: ReturnType<typeof rstest.fn>;
  unobserve: ReturnType<typeof rstest.fn>;
  disconnect: ReturnType<typeof rstest.fn>;
  /** 테스트에서 호출해 resize 이벤트를 시뮬레이션한다. */
  triggerResize: (entries: ResizeObserverEntry[]) => void;
}

/** 생성된 mock 인스턴스를 외부에서 참조하기 위한 슬롯. */
let lastMockObserverInstance: MockResizeObserverInstance | null = null;

/**
 * ResizeObserver 를 테스트용 class 로 교체한다.
 * - observe / unobserve / disconnect 는 spy 로 기록된다.
 * - triggerResize 를 호출하면 생성자에 전달된 콜백을 실제로 실행한다.
 */
function installMockResizeObserver(): void {
  class MockResizeObserver {
    private readonly _cb: ResizeObserverCallback;
    public readonly observe: ReturnType<typeof rstest.fn>;
    public readonly unobserve: ReturnType<typeof rstest.fn>;
    public readonly disconnect: ReturnType<typeof rstest.fn>;

    constructor(cb: ResizeObserverCallback) {
      this._cb = cb;
      this.observe = rstest.fn();
      this.unobserve = rstest.fn();
      this.disconnect = rstest.fn();

      // 최신 인스턴스를 외부에서 참조할 수 있도록 저장한다.
      lastMockObserverInstance = {
        observe: this.observe,
        unobserve: this.unobserve,
        disconnect: this.disconnect,
        triggerResize: (entries) => {
          this._cb(entries, this as unknown as ResizeObserver);
        },
      };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).ResizeObserver = MockResizeObserver;
}

// ── beforeEach / afterEach ────────────────────────────────────────────────

let originalResizeObserver: typeof ResizeObserver | undefined;

beforeEach(() => {
  // 원래 전역을 보관했다가 복구한다.
   
  originalResizeObserver =
    typeof ResizeObserver !== 'undefined' ? ResizeObserver : undefined;
  lastMockObserverInstance = null;
  installMockResizeObserver();
});

afterEach(() => {
  if (originalResizeObserver !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).ResizeObserver = originalResizeObserver;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (global as any).ResizeObserver;
  }
  lastMockObserverInstance = null;
});

// ── 헬퍼 ──────────────────────────────────────────────────────────────────

/** 최소한의 ResizeObserverEntry 를 생성한다. jsdom 에는 생성자가 없으므로 cast 한다. */
function makeFakeEntry(target: Element): ResizeObserverEntry {
  return { target } as ResizeObserverEntry;
}

// ── 테스트 ────────────────────────────────────────────────────────────────

describe('useResizeObserver', () => {
  /**
   * 시나리오 1: element 를 ref 에 붙이면 observe 가 호출된다.
   *
   * 근거: callback ref 를 content wrapper 에 붙일 때 실제로 관찰을 시작해야 한다.
   */
  it('ref 에 element 를 넘기면 observer.observe(element) 가 호출된다', () => {
    const onResize: ResizeCallback = rstest.fn();
    const { result } = renderHook(() => useResizeObserver(onResize));
    const setRef = result.current;

    const el = document.createElement('div');

    act(() => {
      setRef(el);
    });

    expect(lastMockObserverInstance).not.toBeNull();
    expect(lastMockObserverInstance!.observe).toHaveBeenCalledWith(el);
  });

  /**
   * 시나리오 2: ref 에 null 을 넘기면(detach) 직전 element 에 대해 unobserve 가 호출된다.
   *
   * 근거: element 가 DOM 에서 제거될 때 메모리 누수 없이 관찰을 중단해야 한다.
   */
  it('ref 에 null 을 넘기면 직전 element 에 대해 unobserve 가 호출된다', () => {
    const onResize: ResizeCallback = rstest.fn();
    const { result } = renderHook(() => useResizeObserver(onResize));
    const setRef = result.current;

    const el = document.createElement('div');

    act(() => {
      setRef(el);
    });

    act(() => {
      setRef(null);
    });

    expect(lastMockObserverInstance!.unobserve).toHaveBeenCalledWith(el);
  });

  /**
   * 시나리오 3: element A → B 교체 시 unobserve(A) 후 observe(B) 가 호출된다.
   *
   * 근거: React 에서 ref 대상 element 가 바뀔 수 있다. 이전 element 를 해제하고
   * 새 element 를 등록해야 정확한 관찰이 유지된다.
   */
  it('element A → B 로 교체 시 unobserve(A) 후 observe(B) 가 호출된다', () => {
    const onResize: ResizeCallback = rstest.fn();
    const { result } = renderHook(() => useResizeObserver(onResize));
    const setRef = result.current;

    const elA = document.createElement('div');
    const elB = document.createElement('section');

    act(() => {
      setRef(elA);
    });

    const observeSpy = lastMockObserverInstance!.observe;
    const unobserveSpy = lastMockObserverInstance!.unobserve;

    // 호출 순서를 확인하기 위해 순서 인덱스를 기록한다.
    const callOrder: string[] = [];
    observeSpy.mockImplementation(() => {
      callOrder.push('observe');
    });
    unobserveSpy.mockImplementation(() => {
      callOrder.push('unobserve');
    });

    act(() => {
      setRef(elB);
    });

    expect(unobserveSpy).toHaveBeenCalledWith(elA);
    expect(observeSpy).toHaveBeenCalledWith(elB);
    // unobserve(A) 가 observe(B) 보다 먼저 호출돼야 한다.
    expect(callOrder).toEqual(['unobserve', 'observe']);
  });

  /**
   * 시나리오 4: 훅이 unmount 되면 disconnect() 가 호출된다.
   *
   * 근거: 컴포넌트가 언마운트될 때 ResizeObserver 를 완전히 해제해
   * 메모리 누수와 불필요한 콜백 발화를 막아야 한다.
   */
  it('훅 unmount 시 disconnect() 가 호출된다', () => {
    const onResize: ResizeCallback = rstest.fn();
    const { result, unmount } = renderHook(() => useResizeObserver(onResize));
    const setRef = result.current;

    const el = document.createElement('div');
    act(() => {
      setRef(el);
    });

    const disconnectSpy = lastMockObserverInstance!.disconnect;

    unmount();

    expect(disconnectSpy).toHaveBeenCalledOnce();
  });

  /**
   * 시나리오 5: observer 가 발화하면 onResize 가 그 entry 로 호출된다.
   *
   * 근거: ResizeObserver 콜백이 실제로 사용자에게 제공한 onResize 로 전달돼야 한다.
   * 이것이 측정 파이프라인의 진입점이다.
   */
  it('observer 발화 시 onResize 가 해당 entry 로 호출된다', () => {
    const onResize: ResizeCallback = rstest.fn();
    const { result } = renderHook(() => useResizeObserver(onResize));
    const setRef = result.current;

    const el = document.createElement('div');
    act(() => {
      setRef(el);
    });

    const fakeEntry = makeFakeEntry(el);

    act(() => {
      lastMockObserverInstance!.triggerResize([fakeEntry]);
    });

    expect(onResize).toHaveBeenCalledWith(fakeEntry);
  });

  /**
   * 시나리오 6: onResize 가 새 함수로 교체돼 리렌더돼도 observer 를 재생성하지 않고
   * 최신 onResize 가 호출된다 (callbackRef 패턴).
   *
   * 근거: requirements.md "동적 콘텐츠" — observer 를 재생성하면 observe 호출이
   * 추가로 발생하고 피드백 루프 위험이 생긴다. callbackRef 패턴으로 재생성 없이
   * 최신 콜백을 참조해야 한다.
   *
   * 검증 전략: 리렌더 전에 V1 경로가 실제로 살아있음을 입증한 뒤 mock 기록을 초기화하고,
   * 리렌더 후 발화에서 V2 만 호출되는지 확인한다.
   * 이렇게 해야 "클로저로 옛 onResize 를 직접 부르는" 구현 버그를 5~6단계에서 잡을 수 있다.
   * (리렌더 전 발화 없이 V1.not.toHaveBeenCalled 만 보면 그 버그도 통과해버린다.)
   */
  it('onResize 가 바뀌어 리렌더돼도 observer 를 재생성하지 않고 최신 콜백이 호출된다', () => {
    const onResizeV1: ResizeCallback = rstest.fn();
    const onResizeV2: ResizeCallback = rstest.fn();

    const { result, rerender } = renderHook(
      ({ cb }: { cb: ResizeCallback }) => useResizeObserver(cb),
      { initialProps: { cb: onResizeV1 } },
    );

    const el = document.createElement('div');
    act(() => {
      result.current(el);
    });

    // 단계 1: 리렌더 전에 observer 를 발화해 V1 경로가 살아있음을 입증한다.
    const fakeEntry = makeFakeEntry(el);
    act(() => {
      lastMockObserverInstance!.triggerResize([fakeEntry]);
    });
    expect(onResizeV1).toHaveBeenCalledWith(fakeEntry);

    // 단계 2: 리렌더 전 mock 기록을 초기화한다.
    // 이 초기화 덕분에 리렌더 후 V1 이 호출되면 곧바로 실패한다.
    (onResizeV1 as ReturnType<typeof rstest.fn>).mockClear();
    (onResizeV2 as ReturnType<typeof rstest.fn>).mockClear();

    // 단계 3: observe 호출 횟수를 기준점으로 기록해둔다.
    const observeCallCountBeforeRerender = (
      lastMockObserverInstance!.observe as ReturnType<typeof rstest.fn>
    ).mock.calls.length;
    // 리렌더 전 observer 인스턴스를 보관해 재생성 여부를 확인한다.
    const observerInstanceBeforeRerender = lastMockObserverInstance;

    // 단계 4: onResize 를 새 함수로 교체하여 리렌더한다. element 는 동일하게 유지.
    rerender({ cb: onResizeV2 });

    // 단계 5: 리렌더 후에도 observer 가 재생성되지 않아야 한다.
    // — 같은 인스턴스가 유지되고, observe 가 추가로 호출되지 않아야 한다.
    expect(lastMockObserverInstance).toBe(observerInstanceBeforeRerender);
    expect(
      (lastMockObserverInstance!.observe as ReturnType<typeof rstest.fn>).mock
        .calls.length,
    ).toBe(observeCallCountBeforeRerender);

    // 단계 6: 리렌더 후 observer 를 발화한다.
    act(() => {
      lastMockObserverInstance!.triggerResize([fakeEntry]);
    });

    // 최신 콜백(V2) 이 호출되고, 교체 전 콜백(V1) 은 호출되지 않아야 한다.
    // 클로저로 옛 onResize 를 직접 참조하는 구현이라면 V1 이 호출돼 이 단언에서 실패한다.
    expect(onResizeV2).toHaveBeenCalledWith(fakeEntry);
    expect(onResizeV1).not.toHaveBeenCalled();
  });

  /**
   * 시나리오 7: ResizeObserver 가 없는 환경에서 ref 에 element 를 넘겨도 throw 하지 않는다.
   *
   * 근거: requirements.md "ResizeObserver 미지원 환경(SSR 등)에서는 noop."
   * SSR 이나 구형 브라우저에서 라이브러리가 크래시하면 안 된다.
   */
  it('ResizeObserver 가 없는 환경에서 ref 에 element 를 넘겨도 throw 하지 않고 observe 도 하지 않는다', () => {
    // 이 테스트에서만 ResizeObserver 를 전역에서 제거한다.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (global as any).ResizeObserver;

    const onResize: ResizeCallback = rstest.fn();
    const { result } = renderHook(() => useResizeObserver(onResize));
    const setRef = result.current;

    const el = document.createElement('div');

    // throw 없이 조용히 처리돼야 한다.
    expect(() => {
      act(() => {
        setRef(el);
      });
    }).not.toThrow();

    // observer 가 생성되지 않았으므로 mock instance 도 없어야 한다.
    expect(lastMockObserverInstance).toBeNull();

    // afterEach 에서 복구를 위해 다시 설치한다 (afterEach 는 원본 값으로 복구하는데,
    // 이 테스트에서 삭제했으므로 undefined 로 복구된다).
  });

  /**
   * 시나리오 8: observer 가 여러 entry 를 한 번에 발화하면 onResize 가 entry 각각에 대해 호출된다.
   *
   * 근거: ResizeObserver 의 콜백은 배열로 entries 를 받는다. 소스 구현이 for...of 로
   * 순회하므로 n개의 entry 가 있으면 onResize 가 n번 호출돼야 한다.
   */
  it('observer 가 여러 entry 를 발화하면 onResize 가 entry 각각에 대해 호출된다', () => {
    const onResize: ResizeCallback = rstest.fn();
    const { result } = renderHook(() => useResizeObserver(onResize));
    const setRef = result.current;

    const el = document.createElement('div');
    act(() => {
      setRef(el);
    });

    const entries = [makeFakeEntry(el), makeFakeEntry(el)];

    act(() => {
      lastMockObserverInstance!.triggerResize(entries);
    });

    expect(onResize).toHaveBeenCalledTimes(2);
    expect(onResize).toHaveBeenNthCalledWith(1, entries[0]);
    expect(onResize).toHaveBeenNthCalledWith(2, entries[1]);
  });

  /**
   * 시나리오 9: ref 에 null 을 넘겨도 observer 가 아직 생성되지 않은 경우 throw 하지 않는다.
   *
   * 근거: React 는 ref cleanup 으로 먼저 null 을 넘길 수 있다. 초기 null 전달 시
   * observer 가 없어도 안전해야 한다. element 없이 null 만 전달했으므로
   * observer 자체가 생성되지 않아야 하고, unobserve/disconnect 도 호출되지 않아야 한다.
   */
  it('observer 가 없는 상태에서 null 을 넘겨도 throw 하지 않는다', () => {
    const onResize: ResizeCallback = rstest.fn();
    const { result } = renderHook(() => useResizeObserver(onResize));
    const setRef = result.current;

    expect(() => {
      act(() => {
        setRef(null);
      });
    }).not.toThrow();

    // null 만 전달했으므로 observer 인스턴스가 생성되지 않아야 한다.
    // lastMockObserverInstance 는 MockResizeObserver 생성자에서만 설정되므로,
    // null 이면 ResizeObserver 생성자가 호출되지 않았음을 의미한다.
    expect(lastMockObserverInstance).toBeNull();

    // observer 가 없으므로 unobserve/disconnect 도 호출되지 않아야 한다.
    // (lastMockObserverInstance 가 null 이므로 직접 접근 대신 생성자 spy 로 확인한다.)
    const constructorSpy = rstest.spyOn(
      global as unknown as { ResizeObserver: typeof ResizeObserver },
      'ResizeObserver',
    );
    expect(constructorSpy).not.toHaveBeenCalled();
    constructorSpy.mockRestore();
  });
});
