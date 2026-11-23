'use client';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import type { TransactionRow } from '@/types/contracts';
import { Button, Notice } from '@/components/ui';
import { parseDraft } from './draft';
import { KIND_OPTIONS, MONTH_NAMES, draftFromRow, type EntryDraft } from './present';
import { useTransactions } from './useTransactions';
import { yearOptions } from './query';

type Props = {
  projectId: string;
  today: string;
  /** Row being edited, or null for a new entry. */
  row: TransactionRow | null;
  /** Month shown on screen, used as the starting month of a new entry. */
  defaultMonth: { year: number; month: number };
  /** inline = demo quick-entry grid (desktop); screen = single column full screen (phone). */
  variant: 'inline' | 'screen';
  onDone: () => void;
};

/** One form for both shells; the layout classes differ, the fields and rules do not. */
export function EntryForm({ projectId, today, row, defaultMonth, variant, onDone }: Props) {
  const uid = useId();
  const tx = useTransactions(projectId);
  const [draft, setDraft] = useState<EntryDraft>(
    row
      ? draftFromRow(row)
      : { year: String(defaultMonth.year), month: String(defaultMonth.month), day: '', kind: 'income', amount: '', details: '' },
  );
  // One request id per draft: a retry after a lost response must not create a second transaction.
  const requestId = useRef(crypto.randomUUID());
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof EntryDraft>(key: K, value: EntryDraft[K]) => setDraft(d => ({ ...d, [key]: value }));

  async function submit(event?: { preventDefault(): void }) {
    event?.preventDefault();
    const parsed = parseDraft(draft);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      const first = Object.keys(parsed.errors)[0];
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`[id$='-${first}']`)?.focus());
      return;
    }
    setErrors({});
    const saved = row ? await tx.update(row, parsed.fields) : await tx.create(parsed.fields, requestId.current);
    if (saved && !row) requestId.current = crypto.randomUUID();
    if (!saved) return;
    if (row) onDone();
    else setDraft(d => ({ ...d, day: '', amount: '', details: '' })); // keep month and type for the next entry
    if (!row && variant === 'screen') onDone();
  }
  function keys(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); onDone(); }
  }

  const field = (name: keyof EntryDraft, label: string, control: React.ReactNode) => (
    <div className={`fin-field fin-field--${name}`}>
      <label htmlFor={`${uid}-${name}`}>{label}</label>
      {control}
      {errors[name] && <span className="ui-field__error" role="alert" id={`${uid}-${name}-err`}>{errors[name]}</span>}
    </div>
  );
  const aria = (name: string) => ({ id: `${uid}-${name}`, 'aria-invalid': errors[name] ? true : undefined, 'aria-describedby': errors[name] ? `${uid}-${name}-err` : undefined });

  return (
    <form ref={formRef} className={`fin-entry fin-entry--${variant}`} onSubmit={submit} onKeyDown={keys} noValidate>
      <div className="fin-entry__grid">
        <div className="fin-field fin-field--date">
          <span className="fin-field__legend" id={`${uid}-date`}>חודש, שנה ויום</span>
          <div className="fin-date" role="group" aria-labelledby={`${uid}-date`}>
            <select {...aria('month')} aria-label="חודש" value={draft.month} onChange={e => set('month', e.target.value)}>
              {MONTH_NAMES.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
            </select>
            <select {...aria('year')} aria-label="שנה" value={draft.year} onChange={e => set('year', e.target.value)}>
              {yearOptions(today, Number(draft.year)).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <input {...aria('day')} aria-label="יום (רשות)" placeholder="יום" inputMode="numeric" maxLength={2} value={draft.day} onChange={e => set('day', e.target.value)} />
          </div>
          {(errors.month || errors.year || errors.day) && <span className="ui-field__error" role="alert">{errors.month ?? errors.year ?? errors.day}</span>}
        </div>
        {field('kind', 'סוג', (
          <select {...aria('kind')} value={draft.kind} onChange={e => set('kind', e.target.value as EntryDraft['kind'])}>
            {KIND_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ))}
        {field('amount', 'סכום לפני מע״מ (₪)', (
          <input {...aria('amount')} inputMode="decimal" dir="ltr" autoComplete="off" value={draft.amount} onChange={e => set('amount', e.target.value)} />
        ))}
        {field('details', 'פרטים / ספק', (
          <input {...aria('details')} maxLength={500} autoComplete="off" value={draft.details} onChange={e => set('details', e.target.value)} />
        ))}
        <div className="fin-entry__actions">
          <Button type="submit" disabled={tx.busy}>{tx.busy ? 'שומר…' : row ? 'שמירה' : 'הוספה'}</Button>
          {(row || variant === 'screen') && <Button variant="secondary" onClick={onDone} disabled={tx.busy}>ביטול</Button>}
        </div>
      </div>
      {tx.error && <Notice tone="error">{tx.error}</Notice>}
    </form>
  );
}
