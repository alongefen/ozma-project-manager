'use client';
import { createContext, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { Result, TaskAssignee, TaskRow } from '@/types/contracts';
import { ConfirmDialog, Notice, Sheet } from '@/components/ui';
import { createTask, deleteTask, setTaskCompleted, updateTask } from '../logic/actions';
import { TaskForm } from './TaskForm';
import { onlyMine, sameIds, withRevision, withToggled, withoutTask, type TaskLists } from './model';

type Props = { projectId: string; initial: TaskLists; canWrite: boolean; canDelete: boolean; today: string; assignees: TaskAssignee[]; userId: string; initialMine: boolean; children?: ReactNode };

type Ctx = {
  lists: TaskLists; mine: boolean; toggleMine: () => void; canWrite: boolean; canDelete: boolean; today: string; busy: ReadonlySet<string>;
  toggle: (task: TaskRow) => void;
  openCreate: () => void; openEdit: (task: TaskRow) => void; askDelete: (task: TaskRow) => void;
};
const TasksContext = createContext<Ctx | null>(null);
export const useTasks = () => { const c = useContext(TasksContext); if (!c) throw new Error('TasksProvider missing'); return c; };

/**
 * The one state of both layouts. Toggling is instant and rolls back with a message if the server refuses;
 * writes go only through the server actions, and the page refreshes afterwards so counts and revisions come from the server.
 */
export function TasksProvider({ projectId, initial, canWrite, canDelete, today, assignees, userId, initialMine, children }: Props) {
  const [mine, setMine] = useState(initialMine);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [seen, setSeen] = useState(initial);
  const [lists, setLists] = useState(initial);
  // New data from the server replaces the local copy (adjusting state during render, no effect needed).
  if (seen !== initial) { setSeen(initial); setLists(initial); }
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ task: TaskRow | null } | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<TaskRow | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  // A retry after a lost answer keeps the same request id; any other failure starts the next create fresh.
  const ambiguous = useRef(false);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 8000);
    return () => clearTimeout(t);
  }, [error]);
  const refresh = () => startTransition(() => router.refresh());
  const mark = (id: string, on: boolean) => setBusy(s => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });

  async function guarded(action: () => Promise<Result<unknown>>): Promise<Result<unknown>> {
    try { return await action(); } catch { return { ok: false, error: { code: 'UNAVAILABLE', message: 'הפעולה לא הושלמה. יש לנסות שוב' } } as Result<unknown>; }
  }

  async function toggle(task: TaskRow) {
    if (busy.has(task.id)) return;
    const next = !task.completed;
    mark(task.id, true); setError(null);
    setLists(l => withToggled(l, task.id, next));
    const result = await guarded(() => setTaskCompleted({ id: task.id, expectedRevision: task.revision, completed: next }));
    mark(task.id, false);
    if (result.ok) {
      // The new revision comes with the answer, so a quick second tap is not a stale write.
      setLists(l => withRevision(l, task.id, (result.value as { revision: number }).revision));
    } else {
      setLists(l => withToggled(l, task.id, !next)); // undo only this row, other in-flight toggles stay
      setError(result.error.message);
      if (result.error.code !== 'CONFLICT') return;
    }
    refresh();
  }

  async function submit(fields: { body: string; dueDate: string | null; assigneeIds: string[] }) {
    setFormBusy(true); setFormError(null);
    const task = form?.task ?? null;
    const dueDate = fields.dueDate as TaskRow['dueDate'];
    const result = await guarded(() => task
      ? updateTask({ id: task.id, expectedRevision: task.revision, body: fields.body, dueDate, // An unchanged list is not sent, so a task whose assignee left the project can still be edited.
          ...(sameIds(fields.assigneeIds, task.assignees.map(a => a.id)) ? {} : { assigneeIds: fields.assigneeIds }) })
      : createTask({ requestId, projectId, body: fields.body, dueDate, completed: false, assigneeIds: fields.assigneeIds }));
    setFormBusy(false);
    if (!result.ok) {
      ambiguous.current = result.error.code === 'UNAVAILABLE';
      // The note changed under us: close with the message so the next open starts from the fresh revision.
      if (result.error.code === 'CONFLICT') { setForm(null); setError(result.error.message); refresh(); return; }
      setFormError(result.error.message); return;
    }
    ambiguous.current = false;
    if (!task) setRequestId(crypto.randomUUID());
    setForm(null);
    refresh();
  }

  async function confirmDelete() {
    if (!removing) return;
    const task = removing;
    setRemoveBusy(true); setRemoveError(null);
    const result = await guarded(() => deleteTask({ id: task.id, expectedRevision: task.revision }));
    setRemoveBusy(false);
    if (!result.ok) {
      if (result.error.code === 'CONFLICT') { setRemoving(null); setError(result.error.message); refresh(); return; }
      setRemoveError(result.error.message); return;
    }
    setLists(l => withoutTask(l, task.id));
    setRemoving(null);
    refresh();
  }

  // "המשימות שלי" narrows the open list to the signed-in user's tasks; the done group stays as is.
  const shown: TaskLists = mine ? { open: onlyMine(lists.open, userId), completed: lists.completed } : lists;
  const value: Ctx = {
    lists: shown, mine, toggleMine: () => setMine(v => !v), canWrite, canDelete, today, busy, toggle,
    openCreate: () => { setFormError(null); if (!ambiguous.current) setRequestId(crypto.randomUUID()); setForm({ task: null }); },
    openEdit: task => { setFormError(null); setForm({ task }); },
    askDelete: task => { setRemoveError(null); setRemoving(task); },
  };
  return (
    <TasksContext.Provider value={value}>
      <div className="tk-root">
        {error && <Notice tone="error">{error}</Notice>}
        {children}
      </div>
      <Sheet open={form !== null} onClose={() => setForm(null)} dismissible={!formBusy} title={form?.task ? 'עריכת משימה' : 'משימה חדשה'}>
        {form && <TaskForm task={form.task} assignees={assignees} busy={formBusy} error={formError} onSubmit={submit} onCancel={() => setForm(null)} />}
      </Sheet>
      <ConfirmDialog open={removing !== null} title="מחיקת משימה" confirmLabel="מחיקה" busyLabel="מוחק…" busy={removeBusy} error={removeError} danger onConfirm={confirmDelete} onCancel={() => setRemoving(null)}>
        <p>המשימה תוסר מהרשימה. הוא נשמר בהיסטוריה ולא נמחק לצמיתות.</p>
      </ConfirmDialog>
    </TasksContext.Provider>
  );
}
