import { useLayoutEffect, useRef, useState, type RefObject } from "react";

export interface ElementSize {
  width: number;
  height: number;
}

function nonNegativeFinite(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function useElementSize(ref: RefObject<HTMLElement | null>): ElementSize {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });
  const observedElement = useRef<HTMLElement | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) {
      observerRef.current?.disconnect();
      observerRef.current = null;
      observedElement.current = null;
      setSize((previous) => previous.width === 0 && previous.height === 0 ? previous : { width: 0, height: 0 });
      return;
    }
    if (observedElement.current === element) {
      return;
    }
    observerRef.current?.disconnect();
    observerRef.current = null;
    observedElement.current = element;
    const update = (width: number, height: number): void => {
      const nextSize = { width: nonNegativeFinite(width), height: nonNegativeFinite(height) };
      setSize((previous) => previous.width === nextSize.width && previous.height === nextSize.height ? previous : nextSize);
    };
    if (typeof ResizeObserver === "undefined") {
      const rect = element.getBoundingClientRect();
      update(rect.width, rect.height);
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) {
        update(entry.contentRect.width, entry.contentRect.height);
      }
    });
    observerRef.current = observer;
    observer.observe(element);
    const rect = element.getBoundingClientRect();
    update(rect.width, rect.height);
  });

  useLayoutEffect(() => () => observerRef.current?.disconnect(), []);

  return size;
}
