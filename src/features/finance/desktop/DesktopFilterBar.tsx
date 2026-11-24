'use client';
import { useId } from 'react';
import type { FinanceFilter } from '@/types/contracts';
import { Button, FilterPopup, SelectField, TextField } from '@/components/ui';
import { useFinanceNav } from '../shared/nav';
import { MONTH_NAMES, monthLabel } from '../shared/present';
import { currentMonth, yearOptions } from '../shared/query';

/** Desktop filter bar: live search always visible, a popover under the button for period and day, chips for what is active. */
export function DesktopFilterBar({ today, onAdd }: { today: string; onAdd?: () => void }) {
  const { filter, go, all, goProject } = useFinanceNav();
  const uid = useId();
  const period = filter.period;
  const nonDefaultPeriod = period !== 'all';
  const chips: { key: string; label: string; remove: () => void }[] = [];
  if (nonDefaultPeriod) chips.push({ key: 'period', label: monthLabel(period as { year: number; month: number }), remove: () => go({ ...filter, period: 'all' }) });
  if (filter.day !== undefined) chips.push({ key: 'day', label: `יום ${filter.day}`, remove: () => go({ ...filter, day: undefined }) });
  const activeCount = chips.length + (filter.search ? 1 : 0) + (all?.project ? 1 : 0);

  const base = currentMonth(today);
  function apply(values: FormData) {
    const month = String(values.get('month') ?? '');
    const year = String(values.get('year') ?? '');
    const day = String(values.get('day') ?? '').trim();
    const d = Number(day);
    const next: FinanceFilter = { period: month ? { year: Number(year || base.year), month: Number(month) } : 'all' };
    if (day && Number.isInteger(d) && d >= 1 && d <= 31) next.day = d;
    if (filter.search) next.search = filter.search;
    go(next);
  }

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
      <FilterPopup title="סינון" count={activeCount} onApply={apply} onClear={() => go({ period: 'all', ...(filter.search ? { search: filter.search } : {}) })}>
        <PeriodFields today={today} filter={filter} />
      </FilterPopup>
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

/** Period and day fields of the shared filter popup (desktop). Values are read by name when "החלה" is pressed. */
function PeriodFields({ today, filter }: { today: string; filter: FinanceFilter }) {
  const base = currentMonth(today);
  const month = filter.period === 'all' ? '' : String(filter.period.month);
  const year = filter.period === 'all' ? '' : String(filter.period.year);
  return (
    <>
      <div className="ui-fhalf"><SelectField name="month" label="חודש" defaultValue={month} options={[{ value: '', label: 'הכול' }, ...MONTH_NAMES.map((n, i) => ({ value: String(i + 1), label: n }))]} /></div>
      <div className="ui-fhalf"><SelectField name="year" label="שנה" defaultValue={year} options={[{ value: '', label: month ? String(base.year) : 'הכול' }, ...yearOptions(today, Number(year) || undefined).map(y => ({ value: String(y), label: String(y) }))]} /></div>
      <TextField name="day" label="יום בחודש" inputMode="numeric" maxLength={2} defaultValue={filter.day === undefined ? '' : String(filter.day)} />
    </>
  );
}
