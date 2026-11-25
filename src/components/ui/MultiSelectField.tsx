'use client';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Popup } from './Popup';
import type { SelectOption } from './SelectField';
import pickers from './Pickers.module.css';
import css from './MultiSelectField.module.css';

type Props = {
  options: (SelectOption & { hint?: string })[];
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Text of the chip for a chosen value that is no longer in `options` (removable, so it is never stuck). */
  unknownLabel?: string;
  'aria-label'?: string;
};

/**
 * Dropdown with several values (like a people picker): the chosen ones stay visible as chips, each with its own small remove button,
 * and the list opens in the same pop-up as SelectField (menu on desktop, bottom sheet on the phone) and stays open while ticking.
 */
export function MultiSelectField({ options, value, onChange, label, placeholder = 'בחירה', disabled, unknownLabel = 'לא זמין', 'aria-label': ariaLabel }: Props) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const closedAt = useRef(0);

  const chosen = value.map(v => options.find(o => o.value === v) ?? { value: v, label: unknownLabel });
  const q = query.trim().toLowerCase();
  const shown = q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
  const remove = (v: string) => { onChange(value.filter(x => x !== v)); trigger.current?.focus(); };

  const enabled = (i: number) => i >= 0 && i < shown.length && !shown[i].disabled;
  const move = (from: number, step: 1 | -1) => { for (let i = from + step; i >= 0 && i < shown.length; i += step) if (enabled(i)) return i; return from; };
  const openMenu = () => { if (disabled) return; setQuery(''); setActive(Math.max(0, options.findIndex(o => !o.disabled))); setOpen(true); };
  // Desktop only: on the phone the search box would raise the keyboard over the list.
  useEffect(() => { if (open && window.matchMedia('(min-width: 1024px)').matches) search.current?.focus(); }, [open]);
  useEffect(() => { if (open) list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }); }, [open, active]);

  const onSearchKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => move(a, 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => move(a, -1)); }
    else if (e.key === 'Enter') { e.preventDefault(); const o = shown[active]; if (o && !o.disabled) toggle(o.value); }
    e.stopPropagation();
  };
  const onTriggerKey = (e: KeyboardEvent) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openMenu(); } };

  const control = (
    <div ref={box} className={css.box} data-disabled={disabled || undefined}
      onClick={e => { if (e.target === e.currentTarget && !open && performance.now() - closedAt.current > 300) openMenu(); }}>
      {chosen.length > 0 && (
        <ul className={css.chips} role="list" aria-label={label ?? ariaLabel}>
          {chosen.map(o => (
            <li key={o.value} className={css.chip}>
              <span className={css.chipText}>{o.label}</span>
              <button type="button" className={css.chipX} disabled={disabled} aria-label={`הסרת ${o.label}`} onClick={() => remove(o.value)}>
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button ref={trigger} type="button" id={uid} className={css.add} disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onKeyDown={onTriggerKey}
        aria-label={ariaLabel ?? `${label ?? placeholder}: ${chosen.length ? chosen.map(o => o.label).join(', ') : 'ללא'}. הוספה`}
        onClick={() => { if (open) setOpen(false); else if (performance.now() - closedAt.current > 300) openMenu(); }}>
        <span className={chosen.length ? css.addText : pickers.placeholder}>{chosen.length ? 'הוספה' : placeholder}</span>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className={pickers.chevron}><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <Popup open={open} onClose={() => { closedAt.current = performance.now(); setOpen(false); }} anchor={box} title={label ?? ariaLabel ?? placeholder}>
        <div className={pickers.search}>
          <input ref={search} type="search" role="combobox" aria-expanded="true" aria-haspopup="listbox" aria-activedescendant={shown.length ? `${uid}-o${active}` : undefined} className={pickers.searchInput} aria-label="חיפוש ברשימה" placeholder="חיפוש" autoComplete="off" enterKeyHint="search"
            value={query} onChange={e => { setQuery(e.target.value); setActive(0); }} onKeyDown={onSearchKey} aria-controls={`${uid}-list`} />
        </div>
        {shown.length === 0 && <p className={pickers.none}>לא נמצאו תוצאות</p>}
        <ul id={`${uid}-list`} ref={list} role="listbox" aria-multiselectable="true" className={pickers.options} aria-label={label ?? ariaLabel}>
          {shown.map((o, i) => {
            const on = value.includes(o.value);
            return (
              <li key={o.value} id={`${uid}-o${i}`} role="option" aria-selected={on} aria-disabled={o.disabled || undefined} data-active={i === active}
                className={pickers.option} onPointerMove={() => { if (i !== active) setActive(i); }} onClick={() => { if (!o.disabled) toggle(o.value); }}>
                <span>{o.label}{o.hint && <span className={css.hint}> · {o.hint}</span>}</span>
                <span className={css.tick} data-on={on} aria-hidden="true">
                  {on && <svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </span>
              </li>
            );
          })}
        </ul>
        <div className={css.foot}><button type="button" className={pickers.link} onClick={() => setOpen(false)}>סגירה</button></div>
      </Popup>
    </div>
  );
  if (!label) return control;
  return (
    <div className="ui-field">
      <label className="ui-field__label" htmlFor={uid}>{label}</label>
      {control}
    </div>
  );
}
