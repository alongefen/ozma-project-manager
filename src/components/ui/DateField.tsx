'use client';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Popup } from './Popup';
import { MONTHS_HE, WEEKDAYS_HE, WEEKDAYS_LONG_HE, addDays, addMonths, formatDisplay, monthGrid, parseIso, todayIso } from './calendar';
import css from './Pickers.module.css';

type Props = {
  /** ISO date (YYYY-MM-DD) or empty. Controlled; without it the field keeps its own state from `defaultValue`. */
  value?: string;
  defaultValue?: string;
  onChange?: (iso: string) => void;
  label?: string;
  hint?: string;
  error?: string;
  /** Submitted with a plain `<form>` as a hidden input (ISO). */
  name?: string;
  id?: string;
  disabled?: boolean;
  /** Required fields have no "clear" button. */
  required?: boolean;
  placeholder?: string;
  'aria-invalid'?: boolean;
  [key: `data-${string}`]: string | undefined;
};

/** The app's date picker: shows DD/MM/YYYY, opens a Hebrew calendar (week starts on Sunday). Value stays an ISO string. */
export function DateField({ value, defaultValue = '', onChange, label, hint, error, name, id, disabled, required, placeholder = 'בחירת תאריך', 'aria-invalid': ariaInvalid, ...rest }: Props) {
  const auto = useId();
  const uid = id ?? auto;
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  const parsed = parseIso(current);
  const [open, setOpen] = useState(false);
  const [focusDay, setFocusDay] = useState(todayIso());
  const trigger = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const closedAt = useRef(0);
  /** Focus follows the grid while the keyboard moves in it; the month buttons keep their own focus. */
  const gridFocus = useRef(true);
  const data = Object.fromEntries(Object.entries(rest).filter(([k]) => k.startsWith('data-')));
  const today = todayIso();

  const show = parseIso(focusDay) ?? parseIso(today)!;
  const cells = monthGrid(show.y, show.m);

  const openCalendar = () => { if (disabled) return; gridFocus.current = true; setFocusDay(parsed ? current : today); setOpen(true); };
  const close = () => { setOpen(false); trigger.current?.focus(); };
  const set = (iso: string) => { if (value === undefined) setInner(iso); onChange?.(iso); };
  const pick = (iso: string) => { set(iso); close(); };

  // Keep keyboard focus on the focused day while the user moves around the grid.
  useEffect(() => {
    if (open && gridFocus.current) grid.current?.querySelector<HTMLElement>(`[data-iso="${focusDay}"]`)?.focus();
  }, [open, focusDay]);

  const onGridKey = (e: KeyboardEvent) => {
    gridFocus.current = true;
    const step: Record<string, string | undefined> = {
      ArrowLeft: addDays(focusDay, 1), ArrowRight: addDays(focusDay, -1), // RTL: the next day is on the left
      ArrowUp: addDays(focusDay, -7), ArrowDown: addDays(focusDay, 7),
      PageUp: addMonths(focusDay, -1), PageDown: addMonths(focusDay, 1),
    };
    if (step[e.key]) { e.preventDefault(); setFocusDay(step[e.key]!); }
    else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const col = cells.findIndex(c => c.iso === focusDay) % 7; // 0 = Sunday (right side in RTL)
      setFocusDay(addDays(focusDay, e.key === 'Home' ? -col : 6 - col));
    }
  };

  const describedBy = [error && `${uid}-err`, hint && `${uid}-hint`].filter(Boolean).join(' ') || undefined;
  const invalid = ariaInvalid ?? (error ? true : undefined);
  const control = (
    <div className={css.control}>
      <button ref={trigger} type="button" id={uid} className={css.trigger} disabled={disabled} aria-haspopup="dialog" aria-expanded={open}
        data-invalid={invalid} aria-describedby={describedBy} {...data} onClick={() => { if (open) setOpen(false); else if (performance.now() - closedAt.current > 300) openCalendar(); }}>
        <span className={`${parsed ? css.value : css.placeholder} ${css.ltrValue}`}>{parsed ? formatDisplay(current) : placeholder}</span>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" className={css.chevron}><rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M4 10h16M9 3v4M15 3v4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
      </button>
      {name && <input type="hidden" name={name} value={current} />}
      <Popup open={open} onClose={() => { closedAt.current = performance.now(); setOpen(false); }} anchor={trigger} title={label ?? 'בחירת תאריך'} className={css.calendar}>
        <div className={css.calHead}>
          <button type="button" className={css.nav} aria-label="החודש הקודם" onClick={() => { gridFocus.current = false; setFocusDay(addMonths(focusDay, -1)); }}>›</button>
          <strong aria-live="polite">{MONTHS_HE[show.m - 1]} {show.y}</strong>
          <button type="button" className={css.nav} aria-label="החודש הבא" onClick={() => { gridFocus.current = false; setFocusDay(addMonths(focusDay, 1)); }}>‹</button>
        </div>
        <div ref={grid} role="grid" aria-label={`${MONTHS_HE[show.m - 1]} ${show.y}`} className={css.days} onKeyDown={onGridKey}>
          <div role="row" className={css.weekRow}>
            {WEEKDAYS_HE.map((w, i) => <span key={w} role="columnheader" aria-label={WEEKDAYS_LONG_HE[i]} className={css.weekday}>{w}</span>)}
          </div>
          {Array.from({ length: 6 }, (_, r) => (
            <div key={r} role="row" className={css.weekRow}>
              {cells.slice(r * 7, r * 7 + 7).map(c => (
                <button key={c.iso} type="button" role="gridcell" data-iso={c.iso} tabIndex={c.iso === focusDay ? 0 : -1}
                  aria-selected={c.iso === current} aria-current={c.iso === today ? 'date' : undefined}
                  className={`${css.day}${c.inMonth ? '' : ` ${css.outside}`}${c.iso === today ? ` ${css.today}` : ''}`}
                  onClick={() => pick(c.iso)}>{c.day}</button>
              ))}
            </div>
          ))}
        </div>
        <div className={css.calFoot}>
          <button type="button" className={css.link} onClick={() => pick(today)}>היום</button>
          {!required && current && <button type="button" className={css.link} onClick={() => { set(''); close(); }}>ניקוי</button>}
        </div>
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
