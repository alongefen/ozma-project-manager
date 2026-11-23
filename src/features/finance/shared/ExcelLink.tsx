'use client';
import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Notice } from '@/components/ui';
import { setExcelLink } from '../logic/actions';

/** Optional HTTPS link to the team's Excel file: open for viewers, edit for writers. No sync. */
export function ExcelLink({ projectId, link, canWrite }: { projectId: string; link: { url: string | null; revision: number }; canWrite: boolean }) {
  const router = useRouter();
  const uid = useId();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(link.url ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const text = value.trim();
    if (text && !/^https:\/\//i.test(text)) { setError('הקישור חייב להתחיל ב-https://'); return; }
    setBusy(true); setError(null);
    const result = await setExcelLink({ projectId, url: text || null, expectedRevision: link.revision }).catch(() => null);
    setBusy(false);
    if (!result || !result.ok) { setError(result ? result.error.message : 'הפעולה לא הושלמה. יש לנסות שוב'); return; }
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="fin-link">
      {link.url && <a className="ui-btn ui-btn--secondary ui-btn--small" href={link.url} target="_blank" rel="noopener noreferrer">פתיחת קובץ Excel</a>}
      {canWrite && !editing && <Button variant="secondary" size="small" onClick={() => setEditing(true)}>{link.url ? 'עריכת קישור' : 'הוספת קישור ל-Excel'}</Button>}
      {editing && (
        <div className="fin-link__edit">
          <label htmlFor={`${uid}-url`}>קישור לקובץ Excel (https)</label>
          <input id={`${uid}-url`} dir="ltr" inputMode="url" value={value} onChange={e => setValue(e.target.value)} placeholder="https://" />
          <div className="fin-link__actions">
            <Button size="small" onClick={save} disabled={busy}>{busy ? 'שומר…' : 'שמירה'}</Button>
            <Button size="small" variant="secondary" onClick={() => { setEditing(false); setError(null); }}>ביטול</Button>
          </div>
          {error && <Notice tone="error">{error}</Notice>}
        </div>
      )}
    </div>
  );
}
