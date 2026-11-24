'use client';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Popup } from './Popup';
import css from './Pickers.module.css';

export type SelectOption = { value: string; label: string; disabled?: boolean };

type Props = {
  options: SelectOption[];
  /** Controlled value. Without it the field keeps its own state, starting from `defaultValue`. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Visible label. Without it pass `aria-label` (the bare control sits inside a custom layout). */
  label?: string;
  hint?: string;
  error?: string;
  /** Submitted with a plain `<form>` as a hidden input. */
  name?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  className?: string;
  [key: `data-${string}`]: string | undefined;
};

/** The app's dropdown (replaces the native select): a menu under the field on desktop, a bottom sheet on the phone. */
export function SelectField({ options, value, defaultValue = '', onChange, label, hint, error, name, id, placeholder = 'בחירה', disabled, className = '', 'aria-label': ariaLabel, 'aria-invalid': ariaInvalid, 'aria-describedby': ariaDescribedBy, ...rest }: Props) {
  const auto = useId();
  const uid = id ?? auto;
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const closedAt = useRef(0);
  const typed = useRef({ text: '', at: 0 });
  const selected = options.find(o => o.value === current);
  const data = Object.fromEntries(Object.entries(rest).filter(([k]) => k.startsWith('data-')));

  const enabled = (i: number) => i >= 0 && i < options.length && !options[i].disabled;
  const openMenu = () => {
    if (disabled) return;
    const at = options.findIndex(o => o.value === current && !o.disabled);
    setActive(at >= 0 ? at : options.findIndex(o => !o.disabled));
    setOpen(true);
  };
  const close = () => { setOpen(false); trigger.current?.focus(); };
  const choose = (i: number) => {
    if (!enabled(i)) return;
    if (value === undefined) setInner(options[i].value);
    onChange?.(options[i].value);
    close();
  };
  const move = (from: number, step: 1 | -1) => {
    for (let i = from + step; i >= 0 && i < options.length; i += step) if (enabled(i)) return i;
    return from;
  };

  useEffect(() => { if (open) list.current?.focus(); }, [open]);
  useEffect(() => { if (open) list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }); }, [open, active]);

  const onTriggerKey = (e: KeyboardEvent) => {
    if (['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); openMenu(); }
  };
  const onListKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => move(a, 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => move(a, -1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(move(-1, 1)); }
    else if (e.key === 'End') { e.preventDefault(); setActive(move(options.length, -1)); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
    else if (e.key === 'Tab') { setOpen(false); }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      const now = e.timeStamp;
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : '') + e.key, at: now };
      const hit = options.findIndex(o => !o.disabled && o.label.startsWith(typed.current.text));
      if (hit >= 0) setActive(hit);
    }
  };

  const describedBy = [ariaDescribedBy, error && `${uid}-err`, hint && `${uid}-hint`].filter(Boolean).join(' ') || undefined;
  const invalid = ariaInvalid ?? (error ? true : undefined);
  const control = (
    <div className={`${css.control} ${className}`}>
      <button ref={trigger} type="button" id={uid} className={css.trigger} disabled={disabled} aria-haspopup="listbox" aria-expanded={open}
        aria-label={ariaLabel} data-invalid={invalid} aria-describedby={describedBy} {...data}
        onClick={() => { if (open) setOpen(false); else if (performance.now() - closedAt.current > 300) openMenu(); }} onKeyDown={onTriggerKey}>
        <span className={selected && selected.value !== '' ? css.value : css.placeholder}>{selected?.label ?? placeholder}</span>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className={css.chevron}><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {name && <input type="hidden" name={name} value={current} />}
      <Popup open={open} onClose={() => { closedAt.current = performance.now(); setOpen(false); }} anchor={trigger} title={label ?? ariaLabel ?? placeholder}>
        <ul ref={list} role="listbox" tabIndex={-1} className={css.options} aria-label={label ?? ariaLabel} aria-activedescendant={active >= 0 ? `${uid}-o${active}` : undefined} onKeyDown={onListKey}>
          {options.map((o, i) => (
            <li key={o.value} id={`${uid}-o${i}`} role="option" aria-selected={o.value === current} aria-disabled={o.disabled || undefined}
              data-active={i === active} className={css.option} onPointerMove={() => { if (enabled(i) && i !== active) setActive(i); }} onClick={() => choose(i)}>
              <span>{o.label}</span>
              {o.value === current && <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </li>
          ))}
        </ul>
      </Popup>
    </div>
  );
  if (!label) return control;
  return (
    <div className="ui-field">
      <label className="ui-field__label" htmlFor={uid}>{label}</label>
      {control}
      {hint && <span id={`${uid}-hint`} className="ui-field__hint">{hint}</span>}
      {error && <span id={`${uid}-err`} className="ui-field__error">{error}</span>}
    </div>
  );
}
