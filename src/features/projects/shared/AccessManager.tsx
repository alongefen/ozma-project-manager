'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Notice } from '@/components/ui';
import { removeMembership, setFinanceAccess, setMembership } from '@/features/users/logic/actions';
import type { MemberRow, ProjectRole, Result } from '@/types/contracts';
import { errorText } from './view-model';
import { Select } from './Select';
import { Sheet } from './Sheet';
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
  const [adding, setAdding] = useState(false);

  async function run<T>(key: string, call: () => Promise<Result<T>>, done: string) {
    setBusy(key); setError(null); setInfo(null);
    const result = await call();
    setBusy(null);
    if (!result.ok) { setError(errorText(result.error.code, result.error.message)); return; }
    setInfo(done);
    setRemoving(null);
    router.refresh();
  }

  const closeAdd = () => { setAdding(false); setUserId(''); setRole('worker'); };
  async function add() {
    if (!userId) return;
    setBusy('add'); setError(null); setInfo(null);
    const result = await setMembership({ userId, projectId, role, expectedRevision: null });
    setBusy(null);
    if (!result.ok) { setError(errorText(result.error.code, result.error.message)); closeAdd(); return; }
    setInfo('הגישה נוספה');
    closeAdd();
    router.refresh();
  }
  const changeRole = (m: MemberRow, next: ProjectRole) => run(m.userId, () => setMembership({ userId: m.userId, projectId, role: next, expectedRevision: m.revision }), next === 'worker' && m.financeAccess ? 'התפקיד עודכן. גישת הכספים כובתה כי עובד אינו מקבל כספים' : 'התפקיד עודכן');
  const finance = (m: MemberRow, enabled: boolean) => run(m.userId, () => setFinanceAccess({ userId: m.userId, projectId, enabled, expectedRevision: m.revision }), enabled ? 'גישת כספים נפתחה' : 'גישת כספים נסגרה');
  const remove = (m: MemberRow) => run(m.userId, () => removeMembership({ userId: m.userId, projectId, expectedRevision: m.revision }), 'הגישה הוסרה');

  return (
    <div className={css.wrap}>
      {error && <Notice tone="error">{error}</Notice>}
      {info && <Notice>{info}</Notice>}
      <Card panel className={css.card}>
        <div className={css.cardHead}>
          <h2 className={css.title}>משויכים לפרויקט</h2>
          <Button size="small" onClick={() => setAdding(true)}>הוספת גישה</Button>
        </div>
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
                  <div className={css.roleSelect}>
                    <Select label={`תפקיד של ${m.fullName}`} hideLabel value={m.role} disabled={busy !== null}
                      options={[{ value: 'manager', label: ROLE_LABEL.manager }, { value: 'worker', label: ROLE_LABEL.worker }]}
                      onChange={v => v !== m.role && changeRole(m, v as ProjectRole)} />
                  </div>
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
      <Sheet open={adding} onClose={closeAdd} title="הוספת גישה" menus>
        {candidates.length === 0 ? <p className={css.empty}>אין עוד משתמשים פעילים להוספה</p> : (
          <>
            <Select label="אדם" value={userId} onChange={setUserId} placeholder="בחירת אדם" options={candidates.map(c => ({ value: c.id, label: c.fullName }))} />
            <Select label="תפקיד בפרויקט" value={role} onChange={v => setRole(v as ProjectRole)} options={[{ value: 'worker', label: ROLE_LABEL.worker }, { value: 'manager', label: ROLE_LABEL.manager }]} />
            <p className={css.muted}>גישה לכספים נפתחת רק למנהל, אחרי ההוספה.</p>
            <div className={css.row}>
              <Button disabled={!userId || busy !== null} onClick={add}>{busy === 'add' ? 'שומר…' : 'הוספה'}</Button>
              <Button variant="secondary" onClick={closeAdd}>ביטול</Button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}
