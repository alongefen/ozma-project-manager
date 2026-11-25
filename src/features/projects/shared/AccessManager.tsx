'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, ConfirmDialog, DeleteIcon, IconButton, Sheet } from '@/components/ui';
import { removeMembership, setFinanceAccess, setMembership } from '@/features/users/logic/actions';
import type { MemberRow, ProjectRole, Result } from '@/types/contracts';
import { errorText } from './view-model';
import { Select } from './Select';
import css from './AccessManager.module.css';

export type Candidate = { id: string; fullName: string };
const ROLE_LABEL: Record<ProjectRole, string> = { manager: 'מנהל', worker: 'עובד' };
type Toast = { text: string; tone: 'ok' | 'error'; id: number };

/**
 * Per-project permissions (F04, F05). Owner only: the page refuses everyone else before rendering this.
 * Finance access exists only for managers and is off by default. Changes show at once (optimistic) and are
 * rolled back with an error if the server refuses; no page reload is needed. Every write carries the row
 * revision, so a stale screen gets a conflict and a refresh, never an overwrite. Messages are floating
 * toasts, so the list never jumps.
 */
export function AccessManager({ projectId, members: initial, candidates: initialCandidates, admins = [] }: { projectId: string; members: MemberRow[]; candidates: Candidate[]; admins?: string[] }) {
  const router = useRouter();
  const [members, setMembers] = useState(initial);
  const [candidates, setCandidates] = useState(initialCandidates);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<Toast | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<ProjectRole>('worker');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A refresh after a conflict hands us fresh server rows: adopt them during render, not in an effect.
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) { setSeen(initial); setMembers(initial); setCandidates(initialCandidates); }
  const toastCount = useRef(0);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function say(text: string, tone: Toast['tone'] = 'ok') {
    if (timer.current) clearTimeout(timer.current);
    setToast({ text, tone, id: ++toastCount.current });
    timer.current = setTimeout(() => setToast(null), tone === 'error' ? 6000 : 2500);
  }
  const busyFor = (userIdValue: string, on: boolean) => setPending(prev => { const next = new Set(prev); if (on) next.add(userIdValue); else next.delete(userIdValue); return next; });
  const patch = (userIdValue: string, change: Partial<MemberRow>) => setMembers(list => list.map(m => (m.userId === userIdValue ? { ...m, ...change } : m)));

  /** Runs one change on a member row: apply now, undo and explain on failure. */
  async function change<T>(m: MemberRow, apply: Partial<MemberRow>, call: () => Promise<Result<T>>, done: string, revisionOf: (value: T) => number) {
    if (pending.has(m.userId)) return;
    const before = m;
    busyFor(m.userId, true);
    patch(m.userId, apply);
    const result = await call();
    busyFor(m.userId, false);
    if (!result.ok) {
      patch(m.userId, before);
      say(errorText(result.error.code, result.error.message), 'error');
      if (result.error.code === 'CONFLICT') router.refresh();
      return;
    }
    patch(m.userId, { revision: revisionOf(result.value) });
    say(done);
  }

  const changeRole = (m: MemberRow, next: ProjectRole) => change(
    m, { role: next, ...(next === 'worker' ? { financeAccess: false } : {}) },
    () => setMembership({ userId: m.userId, projectId, role: next, expectedRevision: m.revision }),
    next === 'worker' && m.financeAccess ? 'התפקיד עודכן. גישת הכספים כובתה כי עובד אינו מקבל כספים' : 'התפקיד עודכן',
    v => v.revision,
  );
  const finance = (m: MemberRow, enabled: boolean) => change(
    m, { financeAccess: enabled },
    () => setFinanceAccess({ userId: m.userId, projectId, enabled, expectedRevision: m.revision }),
    enabled ? 'גישת כספים נפתחה' : 'גישת כספים נסגרה',
    v => v.revision,
  );
  async function remove(m: MemberRow) {
    busyFor(m.userId, true);
    const result = await removeMembership({ userId: m.userId, projectId, expectedRevision: m.revision });
    busyFor(m.userId, false);
    setRemoving(null);
    if (!result.ok) { say(errorText(result.error.code, result.error.message), 'error'); if (result.error.code === 'CONFLICT') router.refresh(); return; }
    setMembers(list => list.filter(x => x.userId !== m.userId));
    setCandidates(list => (list.some(c => c.id === m.userId) ? list : [...list, { id: m.userId, fullName: m.fullName }]));
    say('הגישה הוסרה');
  }

  const closeAdd = () => { setAdding(false); setUserId(''); setRole('worker'); };
  async function add() {
    const person = candidates.find(c => c.id === userId);
    if (!person || addBusy) return;
    setAddBusy(true);
    const result = await setMembership({ userId, projectId, role, expectedRevision: null });
    setAddBusy(false);
    if (!result.ok) { say(errorText(result.error.code, result.error.message), 'error'); closeAdd(); return; }
    setMembers(list => [...list, { userId: person.id, fullName: person.fullName, role, financeAccess: result.value.financeAccess, isActive: true, revision: result.value.revision }]);
    setCandidates(list => list.filter(c => c.id !== person.id));
    closeAdd();
    say('הגישה נוספה');
  }

  return (
    <div className={css.wrap}>
      <Card panel className={css.card}>
        <div className={css.cardHead}>
          <h2 className={css.title}>משויכים לפרויקט</h2>
          <Button size="small" onClick={() => setAdding(true)}>הוספת גישה</Button>
        </div>
        {admins.length > 0 && (
          <section aria-labelledby="am-admins">
            <h3 id="am-admins" className={css.muted}>אדמינים: גישה מלאה לכל הפרויקטים, אי אפשר להסיר</h3>
            <ul className={css.list}>{admins.map(name => <li key={name} className={css.item}><div className={css.who}><strong>{name}</strong></div></li>)}</ul>
          </section>
        )}
        {members.length === 0 && <p className={css.empty}>לא שויך אף אחד לפרויקט</p>}
        <ul className={css.list}>
          {members.map(m => {
            const busy = pending.has(m.userId);
            return (
              <li key={m.userId} className={css.item}>
                <div className={css.who}>
                  <strong>{m.fullName}</strong>
                  {!m.isActive && <span className={css.muted}> (חשבון מושבת)</span>}
                </div>
                <div className={css.controls}>
                    <div className={css.roleSelect}>
                      <Select label={`תפקיד של ${m.fullName}`} hideLabel value={m.role} disabled={busy}
                        options={[{ value: 'manager', label: ROLE_LABEL.manager }, { value: 'worker', label: ROLE_LABEL.worker }]}
                        onChange={v => v !== m.role && changeRole(m, v as ProjectRole)} />
                    </div>
                    <label className={`${css.check}${m.role !== 'manager' ? ` ${css.checkOff}` : ''}`} title={m.role !== 'manager' ? 'גישה לכספים זמינה למנהל בלבד' : undefined}>
                      <input type="checkbox" checked={m.role === 'manager' && m.financeAccess} disabled={busy || m.role !== 'manager'} onChange={e => finance(m, e.target.checked)} />
                      <span>גישה לכספים</span>
                      {m.role !== 'manager' && <span className="sr-only"> (זמינה למנהל בלבד)</span>}
                    </label>
                    <IconButton tone="danger" label={`הסרת גישה של ${m.fullName}`} disabled={busy} onClick={() => setRemoving(m.userId)}><DeleteIcon /></IconButton>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
      {(() => {
        const m = members.find(x => x.userId === removing);
        return (
          <ConfirmDialog open={!!m} danger title="הסרת גישה" confirmLabel="הסרת גישה" busy={m ? pending.has(m.userId) : false}
            onConfirm={() => m && remove(m)} onCancel={() => setRemoving(null)}>
            <p>{m ? `להסיר את הגישה של ${m.fullName} לפרויקט? לא תהיה לו יותר גישה אליו. ההיסטוריה נשמרת.` : ''}</p>
          </ConfirmDialog>
        );
      })()}
      <Sheet open={adding} onClose={closeAdd} title="הוספת גישה" menus>
        {candidates.length === 0 ? <p className={css.empty}>אין עוד משתמשים פעילים להוספה</p> : (
          <>
            <Select label="אדם" value={userId} onChange={setUserId} placeholder="בחירת אדם" options={candidates.map(c => ({ value: c.id, label: c.fullName }))} />
            <Select label="תפקיד בפרויקט" value={role} onChange={v => setRole(v as ProjectRole)} options={[{ value: 'worker', label: ROLE_LABEL.worker }, { value: 'manager', label: ROLE_LABEL.manager }]} />
            <p className={css.muted}>גישה לכספים נפתחת רק למנהל, אחרי ההוספה.</p>
            <div className={css.row}>
              <Button disabled={!userId || addBusy} onClick={add}>{addBusy ? 'שומר…' : 'הוספה'}</Button>
              <Button variant="secondary" onClick={closeAdd}>ביטול</Button>
            </div>
          </>
        )}
      </Sheet>
      <div className={css.toastHost} aria-live="polite" role="status">
        {toast && <div key={toast.id} className={`${css.toast} ${toast.tone === 'error' ? css.toastError : ''}`}>{toast.text}</div>}
      </div>
    </div>
  );
}
