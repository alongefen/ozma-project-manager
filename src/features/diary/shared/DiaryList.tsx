'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { DiaryRow } from '@/types/contracts';
import { Button, ConfirmDialog, Notice } from '@/components/ui';
import { cancelEntry, listEntries } from '../logic/actions';
import { EntryCard } from './EntryCard';
import { groupByDate, mergePage, type DiaryFilter } from './model';

/** The list both layouts render: grouped by work date, "load more" with the server cursor, owner-only cancel with a confirm. */
export function DiaryList({ initial, nextCursor, filter, showProject }: { initial: DiaryRow[]; nextCursor: string | null; filter: DiaryFilter; showProject: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [seen, setSeen] = useState(initial);
  const [rows, setRows] = useState(initial);
  const [cursor, setCursor] = useState(nextCursor);
  if (seen !== initial) { setSeen(initial); setRows(initial); setCursor(nextCursor); }
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<DiaryRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function loadMore() {
    if (!cursor || more) return;
    setMore(true); setError(null);
    try {
      const r = await listEntries({ ...filter, cursor });
      if (r.ok) { setRows(cur => mergePage(cur, r.value.items)); setCursor(r.value.nextCursor); }
      else setError(r.error.message);
    } catch { setError('הפעולה לא הושלמה. יש לנסות שוב'); }
    setMore(false);
  }

  async function confirmCancel() {
    if (!removing) return;
    setBusy(true); setRemoveError(null);
    try {
      const r = await cancelEntry({ id: removing.id, expectedRevision: removing.revision });
      if (!r.ok) { setRemoveError(r.error.message); setBusy(false); if (r.error.code === 'CONFLICT') startTransition(() => router.refresh()); return; }
      setRows(cur => cur.filter(x => x.id !== removing.id));
      setRemoving(null);
      startTransition(() => router.refresh());
    } catch { setRemoveError('הפעולה לא הושלמה. יש לנסות שוב'); }
    setBusy(false);
  }

  if (rows.length === 0) return <p className="dr-empty">אין דיווחים להצגה</p>;
  return (
    <div className="dr-list">
      {groupByDate(rows).map(g => (
        <section key={g.date} className="dr-day" aria-label={g.label}>
          <h3 className="dr-day__title">{g.label}</h3>
          {g.rows.map(r => <EntryCard key={r.id} row={r} showProject={showProject} onCancel={x => { setRemoveError(null); setRemoving(x); }} />)}
        </section>
      ))}
      {error && <Notice tone="error">{error}</Notice>}
      {cursor && <Button variant="secondary" block disabled={more} onClick={loadMore}>{more ? 'טוען…' : 'טעינת דיווחים נוספים'}</Button>}
      <ConfirmDialog open={removing !== null} title="ביטול דיווח" confirmLabel="ביטול הדיווח" busyLabel="מבטל…" busy={busy} error={removeError} danger onConfirm={confirmCancel} onCancel={() => setRemoving(null)}>
        <p>הדיווח יוסר מהיומן ומההדפסות. הוא נשמר עם כל הגרסאות ולא נמחק לצמיתות.</p>
      </ConfirmDialog>
    </div>
  );
}
