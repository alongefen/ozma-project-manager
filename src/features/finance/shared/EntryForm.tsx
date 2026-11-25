'use client';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import type { TransactionRow } from '@/types/contracts';
import { Button, Notice, SelectField } from '@/components/ui';
import { parseDraft } from './draft';
import { KIND_OPTIONS, MONTH_NAMES, draftFromRow, type EntryDraft } from './present';
import { useTransactions } from './useTransactions';
import { yearOptions } from './query';

type Props = {
  projectId: string;
  /** All-projects page: the choices. A new entry then needs a chosen project; an edited one shows its own, fixed. */
  projects?: { id: string; name: string; open: boolean }[];
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
export function EntryForm({ projectId, projects, today, row, defaultMonth, variant, onDone }: Props) {
  const uid = useId();
  const [pid, setPid] = useState(projectId);
  const tx = useTransactions(pid);
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
    if (projects && !row && !pid) { setErrors({ project: 'יש לבחור פרויקט' }); return; }
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

  const field = (name: keyof EntryDraft | 'project', label: string, control: React.ReactNode) => (
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
        {projects && field('project', 'פרויקט', (
          <SelectField {...aria('project')} value={pid} disabled={!!row} placeholder="בחירת פרויקט" onChange={setPid}
            options={(row ? projects : projects.filter(p => p.open)).map(p => ({ value: p.id, label: p.name }))} />
        ))}
        <div className="fin-field fin-field--date">
          <span className="fin-field__legend" id={`${uid}-date`}>חודש, שנה ויום</span>
          <div className="fin-date" role="group" aria-labelledby={`${uid}-date`}>
            <SelectField {...aria('month')} aria-label="חודש" value={draft.month} onChange={v => set('month', v)}
              options={MONTH_NAMES.map((name, i) => ({ value: String(i + 1), label: name }))} />
            <SelectField {...aria('year')} aria-label="שנה" value={draft.year} onChange={v => set('year', v)}
              options={yearOptions(today, Number(draft.year)).map(y => ({ value: String(y), label: String(y) }))} />
            <input {...aria('day')} aria-label="יום (רשות)" placeholder="יום" inputMode="numeric" maxLength={2} value={draft.day} onChange={e => set('day', e.target.value)} />
          </div>
          {(errors.month || errors.year || errors.day) && <span className="ui-field__error" role="alert">{errors.month ?? errors.year ?? errors.day}</span>}
        </div>
        {field('kind', 'סוג', (
          <SelectField {...aria('kind')} value={draft.kind} onChange={v => set('kind', v as EntryDraft['kind'])}
            options={KIND_OPTIONS.map(o => ({ value: o.value, label: o.label }))} />
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
