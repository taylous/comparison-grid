import { useCallback, useEffect, useRef } from 'react';

export type ResizeCallback = (entry: ResizeObserverEntry) => void;

/**
 * 엘리먼트의 크기 변화를 관찰한다. 반환된 callback ref 를 관찰 대상에 붙인다.
 *
 * box/content 분리 구조에서 **content wrapper(`height: auto`)** 에만 붙여야 한다.
 * 측정 대상과 stretch 대상을 분리해 ResizeObserver 피드백 루프를 막는다. (requirements.md)
 *
 * @returns 관찰 대상 element 에 붙일 callback ref. element 가 바뀌거나 unmount 되면 자동으로 관찰을 옮긴다.
 */
export function useResizeObserver<T extends Element>(
  onResize: ResizeCallback,
): (node: T | null) => void {
  // observer 를 재생성하지 않고 최신 콜백을 유지한다.
  const callbackRef = useRef(onResize);
  useEffect(() => {
    callbackRef.current = onResize;
  });

  const observerRef = useRef<ResizeObserver | null>(null);
  const observedRef = useRef<T | null>(null);

  const setRef = useCallback((node: T | null) => {
    if (observerRef.current && observedRef.current) {
      observerRef.current.unobserve(observedRef.current);
    }
    observedRef.current = node;

    // node 가 없거나 ResizeObserver 미지원 환경(SSR 등)이면 관찰하지 않는다.
    if (!node || typeof ResizeObserver === 'undefined') {
      return;
    }
    // observer 는 최초 1회만 생성해 재사용한다. (lazy init)
    if (!observerRef.current) {
      observerRef.current = new ResizeObserver((entries) => {
        for (const entry of entries) {
          callbackRef.current(entry);
        }
      });
    }
    observerRef.current.observe(node);
  }, []);

  useEffect(() => {
    // unmount 시 모든 관찰 해제. observedRef 는 ref cleanup(setRef(null))에서 이미 비워진다.
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  return setRef;
}
