'use client';
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import { Button } from './Button';
import { FilterIcon } from './ActionIcons';
import { Sheet } from './Sheet';

const DESKTOP = '(min-width: 1024px)';
const subscribe = (cb: () => void) => { const m = window.matchMedia(DESKTOP); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); };
const useDesktop = () => useSyncExternalStore(subscribe, () => window.matchMedia(DESKTOP).matches, () => false);

/**
 * The one filter pattern of the system (UI_CONVENTIONS "Filter popup"): a "סינון" button with a count badge of the active
 * filters, and under it a popover on desktop / a bottom sheet on the phone with the same header, the same field grid and the
 * same two buttons: "החלה" (primary) then "ניקוי" (secondary). Fields are plain named controls (`SelectField`, `DateField`,
 * `TextField` with `name` and `defaultValue`); `onApply` gets their values, `onClear` resets the screen's filters. The panel
 * mounts only while open, so each opening starts from the current filter. Put `ui-fhalf` on a field to pair two per row.
 */
export function FilterPopup({ title = 'סינון', count, onApply, onClear, block, className = '', children }: {
  title?: string;
  /** Number of active filters of this screen (0 shows no badge). */
  count: number;
  onApply: (values: FormData) => void;
  onClear: () => void;
  /** Full-width trigger (the phone's pinned action row). */
  block?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const desktop = useDesktop();
  const wrap = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open || !desktop) return;
    const down = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) close(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open, desktop]);

  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); onApply(new FormData(e.currentTarget)); close(); };
  const panel = (
    <form className="ui-fpanel" onSubmit={submit} role="search" aria-label={title}>
      <div className="ui-fpanel__fields">{children}</div>
      <div className="ui-actions ui-actions--sheet ui-fpanel__actions">
        <Button type="submit">החלה</Button>
        <Button variant="secondary" onClick={() => { onClear(); close(); }}>ניקוי</Button>
      </div>
    </form>
  );

  return (
    <div className={`ui-fpop${block ? ' ui-fpop--block' : ''} ${className}`.trim()} ref={wrap}>
      <Button variant="secondary" block={block} aria-expanded={open} aria-haspopup="dialog" aria-label={count > 0 ? `${title}, ${count} פעילים` : title} onClick={() => setOpen(v => !v)}>
        <FilterIcon /> {title}{count > 0 && <span className="ui-count" aria-hidden="true">{count}</span>}
      </Button>
      {open && desktop && (
        <div className="ui-fpop__panel" role="dialog" aria-label={title}>
          <strong className="ui-fpop__head">{title}</strong>
          {panel}
        </div>
      )}
      {open && !desktop && <Sheet open onClose={close} title={title} menus>{panel}</Sheet>}
    </div>
  );
}
