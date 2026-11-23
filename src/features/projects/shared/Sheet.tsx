'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import css from './Sheet.module.css';

/**
 * Modal window in the system style: slides up from the bottom of the screen on the phone and is a
 * centred pop-up on desktop. Built on the native dialog (focus trap, Escape, inert background).
 * Children mount only while open, so every opening starts from a clean state.
 */
export function Sheet({ open, onClose, title, children, menus }: { open: boolean; onClose: () => void; title: string; children: ReactNode; /** The content has dropdown lists that must not be clipped by the window's own scrolling. */ menus?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} className={css.dialog} aria-labelledby={titleId} onClose={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      {open && (
        <div className={css.panel}>
          <header className={css.head}>
            <h2 id={titleId} className={css.title}>{title}</h2>
            <button type="button" className={css.close} aria-label="סגירה" onClick={onClose}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </header>
          <div className={`${css.body}${menus ? ` ${css.menus}` : ''}`}>{children}</div>
        </div>
      )}
    </dialog>
  );
}
