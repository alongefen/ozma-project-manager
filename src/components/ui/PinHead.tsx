'use client';
import { useLayoutEffect, useRef, type ReactNode } from 'react';

/**
 * The pinned top of an inner page (title, and the project tabs when there are any). It sticks to the top of the
 * screen while the page scrolls, and publishes its height as `--pin-h` on its parent, so every `Pin` below it
 * (a screen's primary action row) sticks right under it instead of behind it.
 */
export function PinHead({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const scope = el?.parentElement;
    if (!el || !scope) return;
    const set = () => scope.style.setProperty('--pin-h', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => { ro.disconnect(); scope.style.removeProperty('--pin-h'); };
  }, []);
  return <div ref={ref} className="ui-pinhead">{children}</div>;
}
