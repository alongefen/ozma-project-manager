'use client';
import { useId, useState } from 'react';
import type { FinanceFilter } from '@/types/contracts';
import { Button, SelectField } from '@/components/ui';
import { MONTH_NAMES } from './present';
import { currentMonth, yearOptions } from './query';
import { useFinanceNav } from './nav';

type Props = { today: string; showMonth?: boolean; onDone?: () => void };

/** Period, day and text filters. Changes show instantly; the server recomputes the book. */
export function Filters({ today, showMonth = true, onDone }: Props) {
  const { filter, go, all, goProject } = useFinanceNav();
  const uid = useId();
  const [search, setSearch] = useState(filter.search ?? '');
  const [day, setDay] = useState(filter.day === undefined ? '' : String(filter.day));
  const period = filter.period;
  const selMonth = period === 'all' ? '' : String(period.month);
  const selYear = period === 'all' ? '' : String(period.year);
  const fallback = currentMonth(today);

  function setPeriod(month: string, year: string) {
    if (month === 'all') return go({ ...filter, period: 'all' });
    const base = period === 'all' ? fallback : period;
    go({ ...filter, period: { month: Number(month || base.month), year: Number(year || base.year) } });
  }
  function apply(event: { preventDefault(): void }) {
    event.preventDefault();
    const next: FinanceFilter = { period: filter.period };
    const d = Number(day);
    if (day.trim() && Number.isInteger(d) && d >= 1 && d <= 31) next.day = d;
    if (search.trim()) next.search = search.trim();
    go(next);
    onDone?.();
  }

  return (
    <form className="fin-filters" onSubmit={apply} role="search" aria-label="סינון תנועות">
      {all && (
        <div className="fin-field">
          <label htmlFor={`${uid}-p`}>פרויקט</label>
          <SelectField id={`${uid}-p`} value={all.project ?? ''} onChange={v => { goProject(v || null); onDone?.(); }}
            options={[{ value: '', label: 'כל הפרויקטים' }, ...all.projects.map(p => ({ value: p.id, label: p.name }))]} />
        </div>
      )}
      {showMonth && (
        <>
          <div className="fin-field">
            <label htmlFor={`${uid}-m`}>חודש</label>
            <SelectField id={`${uid}-m`} value={period === 'all' ? 'all' : selMonth} onChange={v => setPeriod(v, selYear)}
              options={[{ value: 'all', label: 'כל התקופה' }, ...MONTH_NAMES.map((name, i) => ({ value: String(i + 1), label: name }))]} />
          </div>
          <div className="fin-field">
            <label htmlFor={`${uid}-y`}>שנה</label>
            <SelectField id={`${uid}-y`} value={selYear} disabled={period === 'all'} onChange={v => setPeriod(selMonth, v)}
              options={[...(period === 'all' ? [{ value: '', label: '—' }] : []), ...yearOptions(today, period === 'all' ? undefined : period.year).map(y => ({ value: String(y), label: String(y) }))]} />
          </div>
        </>
      )}
      <div className="fin-field fin-field--day">
        <label htmlFor={`${uid}-d`}>יום</label>
        <input id={`${uid}-d`} inputMode="numeric" maxLength={2} value={day} onChange={e => setDay(e.target.value)} />
      </div>
      <div className="fin-field fin-field--search">
        <label htmlFor={`${uid}-s`}>ספק / פרטים</label>
        <input id={`${uid}-s`} value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="fin-filters__actions">
        <Button type="submit" size="small">סינון</Button>
        <Button variant="secondary" size="small" onClick={() => { setSearch(''); setDay(''); go({ period: filter.period }); onDone?.(); }}>איפוס</Button>
      </div>
    </form>
  );
}
