'use client';
import { useId, useState } from 'react';
import type { FinanceFilter } from '@/types/contracts';
import { Button } from '@/components/ui';
import { MONTH_NAMES } from './present';
import { currentMonth, yearOptions } from './query';
import { useFinanceNav } from './nav';

type Props = { today: string; showMonth?: boolean };

/** Period, day and text filters. Changes show instantly; the server recomputes the book. */
export function Filters({ today, showMonth = true }: Props) {
  const { filter, go } = useFinanceNav();
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
  }

  return (
    <form className="fin-filters" onSubmit={apply} role="search" aria-label="סינון תנועות">
      {showMonth && (
        <>
          <div className="fin-field">
            <label htmlFor={`${uid}-m`}>חודש</label>
            <select id={`${uid}-m`} value={period === 'all' ? 'all' : selMonth} onChange={e => setPeriod(e.target.value, selYear)}>
              <option value="all">כל התקופה</option>
              {MONTH_NAMES.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
            </select>
          </div>
          <div className="fin-field">
            <label htmlFor={`${uid}-y`}>שנה</label>
            <select id={`${uid}-y`} value={selYear} disabled={period === 'all'} onChange={e => setPeriod(selMonth, e.target.value)}>
              {period === 'all' && <option value="">—</option>}
              {yearOptions(today, period === 'all' ? undefined : period.year).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
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
        <Button variant="secondary" size="small" onClick={() => { setSearch(''); setDay(''); go({ period: filter.period }); }}>איפוס</Button>
      </div>
    </form>
  );
}
