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
    for (const k of ['top', 'bottom', 'left', 'min-width', 'max-height']) el.style.removeProperty(k);
    if (!open || phone || !anchor.current) return;
    // Measured after it is shown: sit under the field if it fits, else above it, else on the roomier side with its own scroll.
    const r = anchor.current.getBoundingClientRect();
    const gap = 4, margin = 8;
    const below = window.innerHeight - r.bottom - gap - margin, above = r.top - gap - margin;
    const natural = el.scrollHeight;
    const underneath = natural <= below || below >= above;
    const room = Math.max(120, underneath ? below : above);
    el.style.setProperty('left', `${Math.max(margin, Math.min(r.left, window.innerWidth - margin - Math.max(r.width, el.offsetWidth)))}px`);
    el.style.setProperty('min-width', `${r.width}px`);
    el.style.setProperty('max-height', `${room}px`);
    if (underneath) el.style.setProperty('top', `${r.bottom + gap}px`);
    else el.style.setProperty('top', `${Math.max(margin, r.top - gap - Math.min(natural, room))}px`);
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
