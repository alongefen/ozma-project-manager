'use client';
import { useState } from 'react';
import { Badge, Button, ConfirmDialog, Notice, TextField } from '@/components/ui';
import { removeMembership, resetPassword, setFinanceAccess, setMembership, setUserActive } from '@/features/users/logic/actions';
import { Select } from '@/features/projects/shared/Select';
import type { ProjectCard, ProjectRole, Result, UserAssignment, UserRow } from '@/types/contracts';
import { ROLE_LABEL, addableProjects, errorText, statusLabel, validatePassword } from './view-model';
import css from './PersonPanel.module.css';

type Props = {
  user: UserRow;
  projects: ProjectCard[];
  patchUser: (id: string, change: (u: UserRow) => UserRow) => void;
  say: (text: string, tone?: 'ok' | 'error') => void;
  refresh: () => void;
};

/**
 * Everything the owner can do for one person: projects and role in each (the role belongs to the project
 * membership, not to the person), finance for managers, reset password, deactivate. The owner's own row is
 * read-only. Role and finance changes show at once and roll back with an error if the server refuses.
 */
export function PersonPanel({ user, projects, patchUser, say, refresh }: Props) {
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState<UserAssignment | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addProject, setAddProject] = useState('');
  const [addRole, setAddRole] = useState<ProjectRole>('worker');
  const [addBusy, setAddBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [resetBusy, setResetBusy] = useState(false);

  const busy = (k: string, on: boolean) => setBusyKeys(prev => { const next = new Set(prev); if (on) next.add(k); else next.delete(k); return next; });
  const patchAssignment = (projectId: string, change: Partial<UserAssignment>) =>
    patchUser(user.id, u => ({ ...u, assignments: u.assignments.map(a => (a.projectId === projectId ? { ...a, ...change } : a)) }));
  const fail = (code: string) => { say(errorText(code), 'error'); if (code === 'CONFLICT') refresh(); };

  async function change(a: UserAssignment, apply: Partial<UserAssignment>, call: () => Promise<Result<{ revision: number }>>, done: string) {
    if (busyKeys.has(a.projectId)) return;
    busy(a.projectId, true);
    patchAssignment(a.projectId, apply);
    const result = await call();
    busy(a.projectId, false);
    if (!result.ok) { patchAssignment(a.projectId, a); fail(result.error.code); return; }
    patchAssignment(a.projectId, { revision: result.value.revision });
    say(done);
  }
  const changeRole = (a: UserAssignment, role: ProjectRole) => change(
    a, { role, ...(role === 'worker' ? { financeAccess: false } : {}) },
    () => setMembership({ userId: user.id, projectId: a.projectId, role, expectedRevision: a.revision }),
    role === 'worker' && a.financeAccess ? 'התפקיד עודכן. גישת הכספים כובתה כי עובד אינו מקבל כספים' : 'התפקיד עודכן',
  );
  const toggleFinance = (a: UserAssignment, enabled: boolean) => change(
    a, { financeAccess: enabled },
    () => setFinanceAccess({ userId: user.id, projectId: a.projectId, enabled, expectedRevision: a.revision }),
    enabled ? 'גישת כספים נפתחה' : 'גישת כספים נסגרה',
  );

  async function confirmRemove() {
    if (!removing) return;
    setDialogBusy(true); setDialogError(null);
    const result = await removeMembership({ userId: user.id, projectId: removing.projectId, expectedRevision: removing.revision });
    setDialogBusy(false);
    if (!result.ok) { setDialogError(errorText(result.error.code)); if (result.error.code === 'CONFLICT') refresh(); return; }
    patchUser(user.id, u => ({ ...u, assignments: u.assignments.filter(a => a.projectId !== removing.projectId) }));
    setRemoving(null);
    say('הגישה הוסרה');
  }

  async function addAccess() {
    const project = projects.find(p => p.id === addProject);
    if (!project || addBusy) return;
    setAddBusy(true);
    const result = await setMembership({ userId: user.id, projectId: project.id, role: addRole, expectedRevision: null });
    setAddBusy(false);
    if (!result.ok) { fail(result.error.code); return; }
    patchUser(user.id, u => ({ ...u, assignments: [...u.assignments, { projectId: project.id, projectName: project.name, role: addRole, financeAccess: result.value.financeAccess, revision: result.value.revision }] }));
    setAdding(false); setAddProject(''); setAddRole('worker');
    say('הגישה נוספה');
  }

  async function setActive(active: boolean) {
    setDialogBusy(true); setDialogError(null);
    const result = await setUserActive({ id: user.id, expectedRevision: user.revision, active });
    setDialogBusy(false);
    if (!result.ok) { if (deactivating) setDialogError(errorText(result.error.code)); else fail(result.error.code); if (result.error.code === 'CONFLICT') refresh(); return; }
    patchUser(user.id, u => ({ ...u, isActive: active, revision: result.value.revision }));
    setDeactivating(false);
    say(active ? 'החשבון הופעל מחדש' : 'החשבון הושבת');
  }

  async function doReset(e: React.FormEvent) {
    e.preventDefault();
    if (resetBusy) return;
    const problem = validatePassword(password);
    setPasswordError(problem);
    if (problem) return;
    setResetBusy(true);
    const result = await resetPassword({ id: user.id, password });
    setResetBusy(false);
    if (!result.ok) { fail(result.error.code); return; }
    setPassword(''); setResetting(false);
    say('הסיסמה אופסה. אפשר למסור אותה לאדם');
    refresh(); // the server may bump the profile revision (sessions are revoked)
  }

  const options = addableProjects(projects, user.assignments);

  return (
    <div className={css.panel}>
      <div className={css.top}>
        <span className={`${css.email} ltr`} dir="ltr">{user.email}</span>
        <Badge tone={user.isActive ? 'active' : 'gray'}>{statusLabel(user)}</Badge>
      </div>

      {user.isOwner ? <Notice>מנהל המערכת רואה את כל הפרויקטים ולא משויך לפרויקט מסוים.</Notice> : (
        <>
          <section className={css.section} aria-labelledby="pp-projects">
            <div className={css.sectionHead}>
              <h3 id="pp-projects" className={css.h}>פרויקטים ותפקיד</h3>
              {user.isActive && <Button size="small" variant="secondary" onClick={() => setAdding(v => !v)} aria-expanded={adding}>הוספת גישה</Button>}
            </div>
            {adding && (
              <div className={css.add}>
                {options.length === 0 ? <p className={css.muted}>אין פרויקט פתוח נוסף לשיוך</p> : (
                  <>
                    <Select label="פרויקט" value={addProject} onChange={setAddProject} placeholder="בחירת פרויקט" options={options.map(p => ({ value: p.id, label: p.name }))} />
                    <Select label="תפקיד בפרויקט" value={addRole} onChange={v => setAddRole(v as ProjectRole)} options={[{ value: 'worker', label: ROLE_LABEL.worker }, { value: 'manager', label: ROLE_LABEL.manager }]} />
                    <p className={css.muted}>גישה לכספים נפתחת רק למנהל, אחרי ההוספה.</p>
                    <div className={css.row}>
                      <Button disabled={!addProject || addBusy} onClick={addAccess}>{addBusy ? 'שומר…' : 'הוספה'}</Button>
                      <Button variant="secondary" disabled={addBusy} onClick={() => setAdding(false)}>ביטול</Button>
                    </div>
                  </>
                )}
              </div>
            )}
            {user.assignments.length === 0 && !adding && <p className={css.muted}>לא משויך לאף פרויקט</p>}
            <ul className={css.list}>
              {user.assignments.map(a => {
                const b = busyKeys.has(a.projectId);
                return (
                  <li key={a.projectId} className={css.item}>
                    <strong className={css.project}>{a.projectName}</strong>
                    <div className={css.controls}>
                      <div className={css.role}>
                        <Select label={`תפקיד ב${a.projectName}`} hideLabel value={a.role} disabled={b}
                          options={[{ value: 'manager', label: ROLE_LABEL.manager }, { value: 'worker', label: ROLE_LABEL.worker }]}
                          onChange={v => v !== a.role && changeRole(a, v as ProjectRole)} />
                      </div>
                      <label className={`${css.check}${a.role !== 'manager' ? ` ${css.off}` : ''}`}>
                        <input type="checkbox" checked={a.role === 'manager' && a.financeAccess} disabled={b || a.role !== 'manager'} onChange={e => toggleFinance(a, e.target.checked)} />
                        <span>גישה לכספים</span>
                        {a.role !== 'manager' && <span className="sr-only"> (זמינה למנהל בלבד)</span>}
                      </label>
                      <Button variant="secondary" size="small" disabled={b} onClick={() => { setDialogError(null); setRemoving(a); }}>הסרת גישה</Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className={css.section} aria-labelledby="pp-account">
            <h3 id="pp-account" className={css.h}>חשבון</h3>
            {resetting ? (
              <form className={css.add} onSubmit={doReset} noValidate>
                <TextField label="סיסמה חדשה" type="password" value={password} onChange={e => setPassword(e.target.value)} error={passwordError} autoComplete="new-password" hint="הסיסמה הקודמת מפסיקה לעבוד והאדם יתחבר מחדש." />
                <div className={css.row}>
                  <Button type="submit" disabled={resetBusy}>{resetBusy ? 'שומר…' : 'איפוס סיסמה'}</Button>
                  <Button variant="secondary" disabled={resetBusy} onClick={() => { setResetting(false); setPassword(''); setPasswordError(undefined); }}>ביטול</Button>
                </div>
              </form>
            ) : (
              <div className={css.row}>
                <Button variant="secondary" onClick={() => setResetting(true)}>איפוס סיסמה</Button>
                {user.isActive
                  ? <Button variant="secondary" onClick={() => { setDialogError(null); setDeactivating(true); }}>השבתת חשבון</Button>
                  : <Button disabled={dialogBusy} onClick={() => setActive(true)}>הפעלה מחדש</Button>}
              </div>
            )}
          </section>
        </>
      )}

      <ConfirmDialog open={!!removing} danger title="הסרת גישה" confirmLabel="הסרת גישה" busy={dialogBusy} error={dialogError}
        onConfirm={confirmRemove} onCancel={() => setRemoving(null)}>
        <p>{removing ? `להסיר את הגישה של ${user.fullName} ל${removing.projectName}? לא תהיה לו יותר גישה אליו. ההיסטוריה נשמרת ושום דבר לא נמחק.` : ''}</p>
      </ConfirmDialog>
      <ConfirmDialog open={deactivating} danger title="השבתת חשבון" confirmLabel="השבתת חשבון" busy={dialogBusy} error={dialogError}
        onConfirm={() => setActive(false)} onCancel={() => setDeactivating(false)}>
        <p>{`להשבית את החשבון של ${user.fullName}? הוא יתנתק ולא יוכל להיכנס. השיוכים והדיווחים שלו נשמרים, ושום דבר לא נמחק. אפשר להפעיל מחדש בכל עת.`}</p>
      </ConfirmDialog>
    </div>
  );
}
