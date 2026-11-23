'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, ConfirmDialog } from '@/components/ui';
import { setProjectArchived, setProjectStatus } from '../logic/actions';
import { errorText } from './view-model';
import css from './ProjectActions.module.css';

type Pending = 'status' | 'archive' | null;

/** Owner-only status and archive actions (F05) with an explicit confirmation step. Writes via server actions only. */
export function ProjectActions({ id, revision, status, archived }: { id: string; revision: number; status: 'active' | 'completed'; archived: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finishing = status === 'active';
  const copy = pending === 'status'
    ? { text: finishing ? 'לסיים את הפרויקט? הוא יעבור לקריאה בלבד למנהלים ולעובדים. שום דבר לא נמחק.' : 'לפתוח את הפרויקט מחדש? אפשר יהיה שוב לדווח ולערוך.', go: finishing ? 'סיום פרויקט' : 'פתיחה מחדש' }
    : { text: archived ? 'להחזיר את הפרויקט מהארכיון?' : 'להעביר את הפרויקט לארכיון? אפשר להחזיר אותו בכל עת. שום דבר לא נמחק.', go: archived ? 'החזרה מהארכיון' : 'העברה לארכיון' };

  async function confirm() {
    setBusy(true);
    setError(null);
    const result = pending === 'status'
      ? await setProjectStatus({ id, expectedRevision: revision, status: finishing ? 'completed' : 'active' })
      : await setProjectArchived({ id, expectedRevision: revision, archived: !archived });
    setBusy(false);
    if (!result.ok) { setError(errorText(result.error.code, result.error.message)); return; }
    setPending(null);
    router.refresh();
  }

  return (
    <div className={css.row}>
      <ConfirmDialog open={pending !== null} title={copy.go} confirmLabel={copy.go} busy={busy} error={error} danger={pending === 'archive' && !archived}
        onConfirm={confirm} onCancel={() => { setPending(null); setError(null); }}>
        <p>{copy.text}</p>
      </ConfirmDialog>
      {!archived && <Button variant="secondary" onClick={() => setPending('status')}>{finishing ? 'סיום פרויקט' : 'פתיחה מחדש'}</Button>}
      <Button variant="secondary" onClick={() => setPending('archive')}>{archived ? 'החזרה מהארכיון' : 'העברה לארכיון'}</Button>
    </div>
  );
}
