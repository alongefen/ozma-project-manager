'use client';
import { useEffect, useId, useRef, useState } from 'react';
import css from './Select.module.css';

export type Option = { value: string; label: string };

/**
 * Dropdown in the system style. The list is exactly as wide as the closed control (a native select
 * popup is drawn by the OS and can be wider), scrolls when long, and opens upwards near the screen bottom.
 */
export function Select({ label, hideLabel, value, options, onChange, placeholder = 'בחירה', disabled }: {
  label: string; hideLabel?: boolean; value: string; options: Option[]; onChange: (value: string) => void; placeholder?: string; disabled?: boolean;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const [active, setActive] = useState(0);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  function toggle() {
    if (disabled) return;
    if (!open && root.current) {
      const rect = root.current.getBoundingClientRect();
      setUp(window.innerHeight - rect.bottom < 260 && rect.top > window.innerHeight - rect.bottom);
      setActive(Math.max(0, options.findIndex(o => o.value === value)));
    }
    setOpen(o => !o);
  }
  function choose(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
  }
  function key(e: React.KeyboardEvent) {
    if (e.key === 'Escape' && open) { e.stopPropagation(); e.preventDefault(); setOpen(false); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { toggle(); return; }
      setActive(i => Math.min(options.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1))));
    } else if ((e.key === 'Enter' || e.key === ' ') && open) { e.preventDefault(); choose(active); }
  }

  return (
    <div className={css.field} ref={root}>
      <span id={`${id}-l`} className={hideLabel ? 'sr-only' : css.label}>{label}</span>
      <div className={css.wrap}>
        <button
          type="button" className={css.button} disabled={disabled} onClick={toggle} onKeyDown={key}
          aria-haspopup="listbox" aria-expanded={open} aria-labelledby={`${id}-l ${id}-b`}
        >
          <span id={`${id}-b`} className={selected ? css.value : css.placeholder}>{selected ? selected.label : placeholder}</span>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" className={css.caret}><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        {open && (
          <ul className={`${css.list}${up ? ` ${css.up}` : ''}`} role="listbox" aria-labelledby={`${id}-l`}>
            {options.map((o, i) => (
              <li key={o.value} role="option" aria-selected={o.value === value} className={`${css.option}${i === active ? ` ${css.active}` : ''}${o.value === value ? ` ${css.chosen}` : ''}`}
                onPointerEnter={() => setActive(i)} onClick={() => choose(i)}>
                {o.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
