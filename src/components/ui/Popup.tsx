'use client';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import css from './Pickers.module.css';

/** True on the phone layout (below the desktop breakpoint), where pickers open as a bottom sheet. */
function usePhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023.98px)');
    const update = () => setPhone(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return phone;
}

/**
 * Shared pop-up of DateField and SelectField. A native popover (top layer, Escape and outside click close it,
 * so it is never clipped by a scrolling window). Desktop: a menu under the field. Phone: a bottom sheet.
 */
export function Popup({ open, onClose, anchor, title, className = '', children }: { open: boolean; onClose: () => void; anchor: RefObject<HTMLElement | null>; title: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const phone = usePhone();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.matches(':popover-open')) el.showPopover();
    if (!open && el.matches(':popover-open')) el.hidePopover();
  }, [open]);

  // Desktop placement is written straight onto the element (it is measured from the anchor each time it opens).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    for (const k of ['top', 'bottom', 'left', 'min-width']) el.style.removeProperty(k);
    if (!open || phone || !anchor.current) return;
    const r = anchor.current.getBoundingClientRect();
    const flip = window.innerHeight - r.bottom < 320 && r.top > window.innerHeight - r.bottom;
    el.style.setProperty('left', `${Math.max(8, Math.min(r.left, window.innerWidth - 8 - Math.max(r.width, 316)))}px`);
    el.style.setProperty('min-width', `${r.width}px`);
    if (flip) el.style.setProperty('bottom', `${window.innerHeight - r.top + 4}px`); else el.style.setProperty('top', `${r.bottom + 4}px`);
  }, [open, phone, anchor]);

  return (
    <div ref={ref} popover="auto" aria-label={title} className={`${css.popup} ${phone ? css.sheet : css.menu} ${className}`}
      onKeyDown={e => { if (e.key === 'Escape') e.stopPropagation(); }}
      onToggle={e => { if ((e.nativeEvent as ToggleEvent).newState === 'closed') onClose(); }}>
      {open && (
        <>
          {phone && <div className={css.sheetHead}><strong>{title}</strong><button type="button" className={css.sheetClose} aria-label="סגירה" onClick={onClose}>✕</button></div>}
          {children}
        </>
      )}
    </div>
  );
}
