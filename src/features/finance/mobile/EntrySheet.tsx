'use client';
import { useEffect, useRef, type ReactNode } from 'react';

/** Bottom sheet: slides up over the list, closes with the X, the backdrop or Escape. */
export function EntrySheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', key); previous?.focus?.(); };
  }, [onClose]);
  return (
    <div className="fin-sheet-backdrop" onClick={onClose}>
      <div ref={ref} className="fin-sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div className="fin-sheet__grab" aria-hidden="true" />
        <div className="fin-sheet__head">
          <h2>{title}</h2>
          <button type="button" className="fin-sheet__x" aria-label="סגירה" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" /></svg>
          </button>
        </div>
        <div className="fin-sheet__body">{children}</div>
      </div>
    </div>
  );
}
