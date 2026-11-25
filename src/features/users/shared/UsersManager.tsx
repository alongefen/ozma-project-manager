'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Pin, SelectField, Sheet, TextField } from '@/components/ui';
import { createUser } from '@/features/users/logic/actions';
import type { ProjectCard, UserRow } from '@/types/contracts';
import { UsersMobile } from '../mobile/UsersMobile';
import { UsersDesktop } from '../desktop/UsersDesktop';
import { PersonPanel } from './PersonPanel';
import { ADMIN_LABEL, EMPTY_FILTER, NO_PROJECT, errorText, filterUsers, projectOptions, sortUsers, validateNewPerson, type NewPersonErrors, type UserFilter } from './view-model';
import css from './UsersManager.module.css';

type Toast = { text: string; tone: 'ok' | 'error'; id: number };

/**
 * People and their access (owner only; the page refuses everyone else before rendering this). One state
 * for both layouts: the phone list and the desktop table are two views of the same rows. The list is
 * fully loaded, so search is local. Writes go through server actions only and carry the row revision.
 */
export function UsersManager({ users: initial, projects, viewerId }: { users: UserRow[]; projects: ProjectCard[]; viewerId: string }) {
  const router = useRouter();
  const [users, setUsers] = useState(initial);
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) { setSeen(initial); setUsers(initial); } // fresh server rows after a conflict
  const [filter, setFilter] = useState<UserFilter>(EMPTY_FILTER);
  const set = (patch: Partial<UserFilter>) => setFilter(f => ({ ...f, ...patch }));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const count = useRef(0);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function say(text: string, tone: Toast['tone'] = 'ok') {
    if (timer.current) clearTimeout(timer.current);
    setToast({ text, tone, id: ++count.current });
    timer.current = setTimeout(() => setToast(null), tone === 'error' ? 6000 : 2500);
  }
  const patchUser = (id: string, change: (u: UserRow) => UserRow) => setUsers(list => list.map(u => (u.id === id ? change(u) : u)));
  const refresh = () => router.refresh();

  const shown = useMemo(() => sortUsers(filterUsers(users, filter)), [users, filter]);
  const projectChoices = useMemo(() => projectOptions(users, projects), [users, projects]);
  const filtered = JSON.stringify(filter) !== JSON.stringify(EMPTY_FILTER);
  const selected = users.find(u => u.id === selectedId) ?? null;

  return (
    <div className={css.wrap}>
      <Pin className={css.bar}>
        <Button className={`${css.add} ui-lead`} icon="add" onClick={() => setAdding(true)}>הוספת אדם</Button>
        <div className={`${css.tools} d-only`}><FilterTools filter={filter} set={set} projects={projectChoices} /></div>
      </Pin>
      <div className={`${css.tools} m-only`}><FilterTools filter={filter} set={set} projects={projectChoices} /></div>
      {shown.length === 0 && <p className={css.empty}>{!filtered ? 'עוד לא נוספו אנשים' : 'לא נמצאו אנשים שמתאימים לסינון'}</p>}
      {shown.length > 0 && (
        <>
          <div className="m-only"><UsersMobile users={shown} onOpen={setSelectedId} /></div>
          <div className="d-only"><UsersDesktop users={shown} onOpen={setSelectedId} /></div>
        </>
      )}
      <NewPersonSheet open={adding} onClose={() => setAdding(false)} onCreated={(row, name) => {
        setUsers(list => [...list, row]);
        setAdding(false);
        say(`${name} נוסף. אפשר לשייך לפרויקטים`);
        setSelectedId(row.id);
      }} />
      <Sheet open={!!selected} onClose={() => setSelectedId(null)} title={selected?.fullName ?? ''}>
        {selected && <PersonPanel key={selected.id} user={selected} users={users} viewerId={viewerId} projects={projects} patchUser={patchUser} say={say} refresh={refresh} />}
      </Sheet>
      <div className={css.toastHost} aria-live="polite" role="status">
        {toast && <div key={toast.id} className={`${css.toast} ${toast.tone === 'error' ? css.toastError : ''}`}>{toast.text}</div>}
      </div>
    </div>
  );
}

function FilterTools({ filter, set, projects }: { filter: UserFilter; set: (p: Partial<UserFilter>) => void; projects: { id: string; name: string }[] }) {
  return (
    <div className={css.filters} role="search" aria-label="סינון אנשים">
      <div className={css.search}><TextField label="חיפוש" hideLabel type="search" placeholder="שם, אימייל או פרויקט" value={filter.search} onChange={e => set({ search: e.target.value })} /></div>
      <SelectField className={css.sel} aria-label="פרויקט" value={filter.projectId} onChange={v => set({ projectId: v })}
        options={[{ value: '', label: 'כל הפרויקטים' }, { value: NO_PROJECT, label: 'ללא פרויקט' }, ...projects.map(p => ({ value: p.id, label: p.name }))]} />
      <SelectField className={css.sel} aria-label="תפקיד" value={filter.role} onChange={v => set({ role: v as UserFilter['role'] })}
        options={[{ value: '', label: 'כל התפקידים' }, { value: 'manager', label: 'מנהל' }, { value: 'worker', label: 'עובד' }, { value: 'owner', label: ADMIN_LABEL }]} />
      <SelectField className={css.sel} aria-label="סטטוס" value={filter.status} onChange={v => set({ status: v as UserFilter['status'] })}
        options={[{ value: '', label: 'כל הסטטוסים' }, { value: 'active', label: 'פעילים' }, { value: 'inactive', label: 'מושבתים' }]} />
    </div>
  );
}

function NewPersonSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (row: UserRow, name: string) => void }) {
  // Children of Sheet mount only while open, so the form starts clean and the request id is new each time.
  return <Sheet open={open} onClose={onClose} title="הוספת אדם">{open && <NewPersonForm onClose={onClose} onCreated={onCreated} />}</Sheet>;
}

function NewPersonForm({ onClose, onCreated }: { onClose: () => void; onCreated: (row: UserRow, name: string) => void }) {
  const [values, setValues] = useState({ fullName: '', email: '', password: '' });
  const [errors, setErrors] = useState<NewPersonErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Same values keep the same request id (a retry after a lost answer cannot create a second person); an edit makes a new one.
  const requestId = useRef(crypto.randomUUID());
  const set = (field: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => { requestId.current = crypto.randomUUID(); setValues(v => ({ ...v, [field]: e.target.value })); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const found = validateNewPerson(values);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setFormError(null);
    const result = await createUser({ requestId: requestId.current, email: values.email.trim(), fullName: values.fullName.trim(), password: values.password });
    setBusy(false);
    if (!result.ok) { setFormError(errorText(result.error.code, 'create')); return; }
    onCreated({ id: result.value.id, fullName: values.fullName.trim(), email: values.email.trim(), isOwner: false, isActive: true, revision: result.value.revision, assignments: [] }, values.fullName.trim());
  }

  return (
    <form className={css.form} onSubmit={submit} noValidate>
      <TextField label="שם מלא" value={values.fullName} onChange={set('fullName')} error={errors.fullName} autoComplete="off" />
      <TextField label="אימייל (שם המשתמש)" type="email" ltr value={values.email} onChange={set('email')} error={errors.email} autoComplete="off" />
      <TextField label="סיסמה ראשונית" type="password" value={values.password} onChange={set('password')} error={errors.password} autoComplete="new-password" hint="מוסרים לאדם בעל פה. אפשר לאפס בכל עת." />
      {formError && <p className={css.formError} role="alert">{formError}</p>}
      <div className="ui-actions ui-actions--sheet">
        <Button type="submit" disabled={busy}>{busy ? 'שומר…' : 'הוספה'}</Button>
        <Button variant="secondary" disabled={busy} onClick={onClose}>ביטול</Button>
      </div>
    </form>
  );
}
