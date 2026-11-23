'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { FinanceFilter } from '@/types/contracts';
import { Button } from '@/components/ui';
import { FilterIcon } from '../shared/FinIcons';
import { useFinanceNav } from '../shared/nav';
import { MONTH_NAMES, monthLabel } from '../shared/present';
import { currentMonth, yearOptions } from '../shared/query';

/** Desktop filter bar: live search always visible, a popover under the button for period and day, chips for what is active. */
export function DesktopFilterBar({ today }: { today: string }) {
  const { filter, go } = useFinanceNav();
  const uid = useId();
  const [search, setSearch] = useState(filter.search ?? '');
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const base = currentMonth(today);

  // Live search: wait for a pause in typing, then ask the server.
  useEffect(() => {
    const text = search.trim();
    if (text === (filter.search ?? '')) return;
    const timer = setTimeout(() => go({ ...filter, search: text || undefined }), 400);
    return () => clearTimeout(timer);
  }, [search, filter, go]);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);

  const period = filter.period;
  const nonDefaultPeriod = period === 'all' || period.year !== base.year || period.month !== base.month;
  const chips: { key: string; label: string; remove: () => void }[] = [];
  if (nonDefaultPeriod) chips.push({ key: 'period', label: period === 'all' ? 'כל התקופה' : monthLabel(period), remove: () => go({ ...filter, period: base }) });
  if (filter.day !== undefined) chips.push({ key: 'day', label: `יום ${filter.day}`, remove: () => go({ ...filter, day: undefined }) });
  const activeCount = chips.length + (filter.search ? 1 : 0);

  return (
    <div className="fin-fbar">
      <div className="fin-field fin-fbar__search">
        <label htmlFor={`${uid}-s`}>חיפוש ספק / פרטים</label>
        <input id={`${uid}-s`} type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="הקלידו לחיפוש" />
      </div>
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
          <button type="button" className="fin-chips__clear" onClick={() => { setSearch(''); go({ period: base }); }}>איפוס הכול</button>
        )}
      </div>
    </div>
  );
}

function FilterPanel({ today, filter, onApply, onClose }: { today: string; filter: FinanceFilter; onApply: (f: FinanceFilter) => void; onClose: () => void }) {
  const uid = useId();
  const base = currentMonth(today);
  const start = filter.period === 'all' ? base : filter.period;
  const [all, setAll] = useState(filter.period === 'all');
  const [month, setMonth] = useState(String(start.month));
  const [year, setYear] = useState(String(start.year));
  const [day, setDay] = useState(filter.day === undefined ? '' : String(filter.day));
  const d = Number(day);
  const dayOk = !day.trim() || (Number.isInteger(d) && d >= 1 && d <= 31);
  const apply = () => {
    if (!dayOk) return;
    const next: FinanceFilter = { period: all ? 'all' : { year: Number(year), month: Number(month) } };
    if (day.trim()) next.day = d;
    if (filter.search) next.search = filter.search;
    onApply(next);
  };
  return (
    <div className="fin-pop__panel" role="dialog" aria-label="סינון תנועות">
      <div className="fin-pop__head">
        <strong>סינון</strong>
        <button type="button" className="fin-chips__clear" onClick={() => onApply({ period: base, ...(filter.search ? { search: filter.search } : {}) })}>ניקוי הכול</button>
      </div>
      <label className="fin-check"><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} /> כל התקופה</label>
      <div className="fin-pop__grid">
        <div className="fin-field">
          <label htmlFor={`${uid}-m`}>חודש</label>
          <select id={`${uid}-m`} disabled={all} value={month} onChange={e => setMonth(e.target.value)}>{MONTH_NAMES.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}</select>
        </div>
        <div className="fin-field">
          <label htmlFor={`${uid}-y`}>שנה</label>
          <select id={`${uid}-y`} disabled={all} value={year} onChange={e => setYear(e.target.value)}>{yearOptions(today, Number(year)).map(y => <option key={y} value={y}>{y}</option>)}</select>
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
