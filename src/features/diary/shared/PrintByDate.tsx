'use client';
import { useId, useState } from 'react';
import { Button, DateField, Notice, SelectField } from '@/components/ui';
import { planReport } from '@/features/reports/logic/actions';
import { ALL_REPORTS_FROM, ALL_REPORTS_TO, reportUrl, isDate, isUuid, type ProjectOption } from './model';

type Mode = 'day' | 'range' | 'all';
const MODES = [{ value: 'day', label: 'יום אחד' }, { value: 'range', label: 'טווח תאריכים' }, { value: 'all', label: 'כל הדיווחים של הפרויקט' }];

/** Pick a project (unless fixed) and one day, a date range or all reports of the project, then print it (opens the PDF) or export it (downloads the PDF). A long day is split into parts by the server. */
export function PrintByDate({ projects, fixedProjectId, today }: { projects: ProjectOption[]; fixedProjectId?: string; today: string }) {
  const idp = useId();
  const [projectId, setProjectId] = useState(fixedProjectId ?? '');
  const [mode, setMode] = useState<Mode>('day');
  const [date, setDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [parts, setParts] = useState(0);
  const valid = isUuid(projectId) && (mode === 'all' || (isDate(date) && (mode === 'day' || (isDate(toDate) && date <= toDate))));
  const scope = mode === 'day' ? { kind: 'day' as const, projectId, date }
    : mode === 'range' ? { kind: 'range' as const, projectId, from: date, to: toDate }
    : { kind: 'range' as const, projectId, from: ALL_REPORTS_FROM, to: ALL_REPORTS_TO };

  async function prepare() {
    if (!valid) { setMessage(mode === 'range' && isDate(date) && isDate(toDate) && date > toDate ? 'תאריך ההתחלה צריך להיות לפני תאריך הסיום' : 'יש לבחור פרויקט ותאריך'); return; }
    setBusy(true); setMessage(null); setParts(0);
    try {
      const r = await planReport({ scope });
      if (!r.ok) setMessage(r.error.message);
      else if (r.value.entryCount === 0) setMessage(mode === 'day' ? 'אין דיווחים בתאריך הזה' : 'אין דיווחים בטווח שנבחר');
      else setParts(r.value.partCount);
    } catch { setMessage('הפעולה לא הושלמה. יש לנסות שוב'); }
    setBusy(false);
  }
  const reset = () => { setParts(0); setMessage(null); };

  return (
    <div className="dr-print">
      {!fixedProjectId && (
        <SelectField id={`${idp}-project`} label="פרויקט" value={projectId} onChange={v => { setProjectId(v); reset(); }}
          options={[{ value: '', label: 'בחירת פרויקט' }, ...projects.map(p => ({ value: p.id, label: p.name }))]} />
      )}
      <SelectField id={`${idp}-mode`} label="מה להדפיס" value={mode} onChange={v => { setMode(v as Mode); reset(); }} options={MODES} />
      {mode !== 'all' && <DateField id={`${idp}-date`} label={mode === 'range' ? 'מתאריך' : 'תאריך'} required value={date} onChange={v => { setDate(v); reset(); }} />}
      {mode === 'range' && <DateField id={`${idp}-to`} label="עד תאריך" required value={toDate} onChange={v => { setToDate(v); reset(); }} />}
      <Button variant="secondary" block disabled={busy} onClick={prepare}>{busy ? 'מכין…' : 'הכנה'}</Button>
      {message && <Notice>{message}</Notice>}
      {parts > 0 && (
        <ul className="dr-parts">
          {Array.from({ length: parts }, (_, i) => i + 1).map(part => (
            <li key={part}>
              <a className="ui-btn ui-btn--small" href={reportUrl(scope, { part })} target="_blank" rel="noopener noreferrer">{parts > 1 ? `הדפסה: חלק ${part} מתוך ${parts}` : 'הדפסה'}</a>
              <a className="ui-btn ui-btn--secondary ui-btn--small" href={reportUrl(scope, { part, download: true })}>{parts > 1 ? `ייצוא PDF: חלק ${part}` : 'ייצוא PDF'}</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
