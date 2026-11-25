'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import css from './Sheet.module.css';

/**
 * Modal window in the system style: slides up from the bottom of the screen on the phone and is a
 * centred pop-up on desktop. Built on the native dialog (focus trap, Escape, inert background).
 * Children mount only while open, so every opening starts from a clean state.
 */
export function Sheet({ open, onClose, title, children, dismissible = true }: { open: boolean; /** False while a request is running: Escape, the X and the backdrop do nothing, so its result always has somewhere to show. */ dismissible?: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    // Give focus back to what opened the window, also when the whole sheet is unmounted while open.
    return () => { if (open) previous?.focus?.(); };
  }, [open]);
  const close = () => { if (dismissible) onClose(); };
  return (
    <dialog ref={ref} className={css.dialog} aria-labelledby={titleId} onClose={onClose} onCancel={e => { if (!dismissible) e.preventDefault(); }} onClick={e => { if (e.target === e.currentTarget) close(); }}>
      {open && (
        <div className={css.panel}>
          <header className={css.head}>
            <h2 id={titleId} className={css.title}>{title}</h2>
            <button type="button" className={css.close} aria-label="סגירה" disabled={!dismissible} onClick={close}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </header>
          <div className={css.body}>{children}</div>
        </div>
      )}
    </dialog>
  );
}
