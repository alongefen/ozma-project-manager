'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Notice } from '@/components/ui';
import { removeMembership, setFinanceAccess, setMembership } from '@/features/users/logic/actions';
import type { MemberRow, ProjectRole, Result } from '@/types/contracts';
import { errorText } from './view-model';
import css from './AccessManager.module.css';

export type Candidate = { id: string; fullName: string };
const ROLE_LABEL: Record<ProjectRole, string> = { manager: 'מנהל', worker: 'עובד' };

/**
 * Per-project assignment (F04, F05). Owner only: the page refuses everyone else before rendering this.
 * Finance access exists only for managers and is off by default. Every change goes through the
 * users server actions with the row revision, so a stale screen gets a conflict, not an overwrite.
 */
export function AccessManager({ projectId, members, candidates }: { projectId: string; members: MemberRow[]; candidates: Candidate[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<ProjectRole>('worker');

  async function run<T>(key: string, call: () => Promise<Result<T>>, done: string) {
    setBusy(key); setError(null); setInfo(null);
    const result = await call();
    setBusy(null);
    if (!result.ok) { setError(errorText(result.error.code, result.error.message)); return; }
    setInfo(done);
    setRemoving(null);
    router.refresh();
  }

  const add = () => userId && run('add', () => setMembership({ userId, projectId, role, expectedRevision: null }), 'השיוך נשמר').then(() => setUserId(''));
  const changeRole = (m: MemberRow, next: ProjectRole) => run(m.userId, () => setMembership({ userId: m.userId, projectId, role: next, expectedRevision: m.revision }), next === 'worker' && m.financeAccess ? 'התפקיד עודכן. גישת הכספים כובתה כי עובד אינו מקבל כספים' : 'התפקיד עודכן');
  const finance = (m: MemberRow, enabled: boolean) => run(m.userId, () => setFinanceAccess({ userId: m.userId, projectId, enabled, expectedRevision: m.revision }), enabled ? 'גישת כספים נפתחה' : 'גישת כספים נסגרה');
  const remove = (m: MemberRow) => run(m.userId, () => removeMembership({ userId: m.userId, projectId, expectedRevision: m.revision }), 'הגישה הוסרה');

  return (
    <div className={css.wrap}>
      {error && <Notice tone="error">{error}</Notice>}
      {info && <Notice>{info}</Notice>}
      <Card panel className={css.card}>
        <h2 className={css.title}>משויכים לפרויקט</h2>
        {members.length === 0 && <p className={css.empty}>לא שויך אף אחד לפרויקט</p>}
        <ul className={css.list}>
          {members.map(m => (
            <li key={m.userId} className={css.item}>
              <div className={css.who}>
                <strong>{m.fullName}</strong>
                {!m.isActive && <span className={css.muted}> (חשבון מושבת)</span>}
              </div>
              {removing === m.userId ? (
                <div className={css.confirm} role="group" aria-label={`הסרת ${m.fullName}`}>
                  <p>להסיר את הגישה של {m.fullName} לפרויקט? לא תהיה לו יותר גישה אליו. ההיסטוריה נשמרת.</p>
                  <div className={css.row}>
                    <Button disabled={busy !== null} onClick={() => remove(m)}>הסרת גישה</Button>
                    <Button variant="secondary" onClick={() => setRemoving(null)}>ביטול</Button>
                  </div>
                </div>
              ) : (
                <div className={css.controls}>
                  <label className={css.inline}>
                    <span className="sr-only">תפקיד של {m.fullName}</span>
                    <select className={css.select} value={m.role} disabled={busy !== null} onChange={e => changeRole(m, e.target.value as ProjectRole)}>
                      <option value="manager">{ROLE_LABEL.manager}</option>
                      <option value="worker">{ROLE_LABEL.worker}</option>
                    </select>
                  </label>
                  {m.role === 'manager' && (
                    <label className={css.check}>
                      <input type="checkbox" checked={m.financeAccess} disabled={busy !== null} onChange={e => finance(m, e.target.checked)} />
                      גישה לכספים
                    </label>
                  )}
                  <Button variant="secondary" size="small" disabled={busy !== null} onClick={() => setRemoving(m.userId)}>הסרת גישה</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Card panel className={css.card}>
        <h2 className={css.title}>הוספת גישה</h2>
        {candidates.length === 0 ? <p className={css.empty}>אין עוד משתמשים פעילים להוספה</p> : (
          <div className={css.add}>
            <label className={css.field}>
              <span>אדם</span>
              <select className={css.select} value={userId} onChange={e => setUserId(e.target.value)}>
                <option value="">בחירת אדם</option>
                {candidates.map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)}
              </select>
            </label>
            <label className={css.field}>
              <span>תפקיד בפרויקט</span>
              <select className={css.select} value={role} onChange={e => setRole(e.target.value as ProjectRole)}>
                <option value="worker">{ROLE_LABEL.worker}</option>
                <option value="manager">{ROLE_LABEL.manager}</option>
              </select>
            </label>
            <Button disabled={!userId || busy !== null} onClick={add}>{busy === 'add' ? 'שומר…' : 'הוספה'}</Button>
          </div>
        )}
        <p className={css.muted}>גישה לכספים נפתחת רק למנהל, אחרי ההוספה.</p>
      </Card>
    </div>
  );
}
