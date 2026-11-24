'use client';
import { useId, useState } from 'react';
import { Button, Notice } from '@/components/ui';
import { planReport } from '@/features/reports/logic/actions';
import { reportUrl, isDate, isUuid, type ProjectOption } from './model';

/** Pick a project (unless fixed) and a date, then print it (opens the PDF) or export it (downloads the PDF). A long day is split into parts by the server. */
export function PrintByDate({ projects, fixedProjectId, today }: { projects: ProjectOption[]; fixedProjectId?: string; today: string }) {
  const idp = useId();
  const [projectId, setProjectId] = useState(fixedProjectId ?? '');
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [parts, setParts] = useState(0);
  const valid = isUuid(projectId) && isDate(date);

  async function prepare() {
    if (!valid) { setMessage('יש לבחור פרויקט ותאריך'); return; }
    setBusy(true); setMessage(null); setParts(0);
    try {
      const r = await planReport({ scope: { kind: 'day', projectId, date } });
      if (!r.ok) setMessage(r.error.message);
      else if (r.value.entryCount === 0) setMessage('אין דיווחים בתאריך הזה');
      else setParts(r.value.partCount);
    } catch { setMessage('הפעולה לא הושלמה. יש לנסות שוב'); }
    setBusy(false);
  }
  const reset = () => { setParts(0); setMessage(null); };

  return (
    <div className="dr-print">
      {!fixedProjectId && (
        <div className="ui-field">
          <label className="ui-field__label" htmlFor={`${idp}-project`}>פרויקט</label>
          <select id={`${idp}-project`} className="ui-field__input" value={projectId} onChange={e => { setProjectId(e.target.value); reset(); }}>
            <option value="">בחירת פרויקט</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}
      <div className="ui-field">
        <label className="ui-field__label" htmlFor={`${idp}-date`}>תאריך</label>
        <input id={`${idp}-date`} type="date" className="ui-field__input dr-date" value={date} onChange={e => { setDate(e.target.value); reset(); }} />
      </div>
      <Button variant="secondary" block disabled={busy} onClick={prepare}>{busy ? 'מכין…' : 'הכנה'}</Button>
      {message && <Notice>{message}</Notice>}
      {parts > 0 && (
        <ul className="dr-parts">
          {Array.from({ length: parts }, (_, i) => i + 1).map(part => (
            <li key={part}>
              <a className="ui-btn ui-btn--small" href={reportUrl({ kind: 'day', projectId, date }, { part })} target="_blank" rel="noopener noreferrer">{parts > 1 ? `הדפסה: חלק ${part} מתוך ${parts}` : 'הדפסה'}</a>
              <a className="ui-btn ui-btn--secondary ui-btn--small" href={reportUrl({ kind: 'day', projectId, date }, { part, download: true })}>{parts > 1 ? `ייצוא PDF: חלק ${part}` : 'ייצוא PDF'}</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
