'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { FinanceFilter } from '@/types/contracts';
import { Button, FilterIcon, SelectField } from '@/components/ui';
import { useFinanceNav } from '../shared/nav';
import { MONTH_NAMES, monthLabel } from '../shared/present';
import { currentMonth, yearOptions } from '../shared/query';

/** Desktop filter bar: live search always visible, a popover under the button for period and day, chips for what is active. */
export function DesktopFilterBar({ today, onAdd }: { today: string; onAdd?: () => void }) {
  const { filter, go, all, goProject } = useFinanceNav();
  const uid = useId();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);

  const period = filter.period;
  const nonDefaultPeriod = period !== 'all';
  const chips: { key: string; label: string; remove: () => void }[] = [];
  if (nonDefaultPeriod) chips.push({ key: 'period', label: monthLabel(period as { year: number; month: number }), remove: () => go({ ...filter, period: 'all' }) });
  if (filter.day !== undefined) chips.push({ key: 'day', label: `יום ${filter.day}`, remove: () => go({ ...filter, day: undefined }) });
  const activeCount = chips.length + (filter.search ? 1 : 0);

  return (
    <div className="fin-fbar">
      {onAdd && <Button className="ui-lead" icon="add" onClick={onAdd}>הוספת תנועה</Button>}
      <div className="fin-field fin-fbar__search">
        <label htmlFor={`${uid}-s`}>חיפוש ספק / פרטים</label>
        <input id={`${uid}-s`} type="search" value={filter.search ?? ''} onChange={e => go({ ...filter, search: e.target.value || undefined })} placeholder="הקלידו לחיפוש" />
      </div>
      {all && (
        <div className="fin-field fin-fbar__project">
          <label htmlFor={`${uid}-p`}>פרויקט</label>
          <SelectField id={`${uid}-p`} value={all.project ?? ''} onChange={v => goProject(v || null)}
            options={[{ value: '', label: 'כל הפרויקטים' }, ...all.projects.map(p => ({ value: p.id, label: p.name }))]} />
        </div>
      )}
      <div className="fin-pop" ref={wrap}>
        <Button variant="secondary" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(v => !v)}>
          <FilterIcon /> סינון{activeCount > 0 && <span className="fin-count">{activeCount}</span>}
        </Button>
        {open && <FilterPanel today={today} filter={filter} onApply={next => { go(next); setOpen(false); }} onClose={() => setOpen(false)} />}
      </div>
      <div className="fin-chips" aria-label="סינון פעיל">
        {chips.map(c => (
          <span key={c.key} className="fin-chip">{c.label}<button type="button" aria-label={`הסרת סינון: ${c.label}`} onClick={c.remove}>×</button></span>
        ))}
        {(chips.length > 0 || filter.search) && (
          <button type="button" className="fin-chips__clear" onClick={() => go({ period: 'all' })}>איפוס הכול</button>
        )}
      </div>
    </div>
  );
}

function FilterPanel({ today, filter, onApply, onClose }: { today: string; filter: FinanceFilter; onApply: (f: FinanceFilter) => void; onClose: () => void }) {
  const uid = useId();
  const base = currentMonth(today);
  const [month, setMonth] = useState(filter.period === 'all' ? '' : String(filter.period.month));
  const [year, setYear] = useState(filter.period === 'all' ? '' : String(filter.period.year));
  const [day, setDay] = useState(filter.day === undefined ? '' : String(filter.day));
  const d = Number(day);
  const dayOk = !day.trim() || (Number.isInteger(d) && d >= 1 && d <= 31);
  const apply = () => {
    if (!dayOk) return;
    const next: FinanceFilter = { period: month ? { year: Number(year || base.year), month: Number(month) } : 'all' };
    if (day.trim()) next.day = d;
    if (filter.search) next.search = filter.search;
    onApply(next);
  };
  return (
    <div className="fin-pop__panel" role="dialog" aria-label="סינון תנועות">
      <div className="fin-pop__head">
        <strong>סינון</strong>
        <button type="button" className="fin-chips__clear" onClick={() => onApply({ period: 'all', ...(filter.search ? { search: filter.search } : {}) })}>ניקוי הכול</button>
      </div>
      <div className="fin-pop__grid">
        <div className="fin-field">
          <label htmlFor={`${uid}-m`}>חודש</label>
          <SelectField id={`${uid}-m`} value={month} onChange={setMonth} options={[{ value: '', label: 'הכול' }, ...MONTH_NAMES.map((n, i) => ({ value: String(i + 1), label: n }))]} />
        </div>
        <div className="fin-field">
          <label htmlFor={`${uid}-y`}>שנה</label>
          <SelectField id={`${uid}-y`} value={year} onChange={setYear} options={[{ value: '', label: month ? String(base.year) : 'הכול' }, ...yearOptions(today, Number(year) || undefined).map(y => ({ value: String(y), label: String(y) }))]} />
        </div>
        <div className="fin-field">
          <label htmlFor={`${uid}-d`}>יום בחודש</label>
          <input id={`${uid}-d`} inputMode="numeric" maxLength={2} value={day} aria-invalid={!dayOk || undefined} onChange={e => setDay(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') apply(); }} />
        </div>
      </div>
      <div className="fin-entry__actions">
        <Button size="small" onClick={apply} disabled={!dayOk}>החלה</Button>
        <Button size="small" variant="secondary" onClick={onClose}>סגירה</Button>
      </div>
    </div>
  );
}
