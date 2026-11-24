import type { IsoDate, TaskRow } from '@/types/contracts';
import { format } from '@/lib/format';

export const MAX_BODY = 2000;

export type TaskLists = { open: TaskRow[]; completed: TaskRow[] };

/** Pure list changes used for the instant (optimistic) update; the server list replaces them on refresh. */
export function withToggled(lists: TaskLists, id: string, completed: boolean): TaskLists {
  const from = completed ? lists.open : lists.completed;
  const row = from.find(t => t.id === id);
  if (!row) return lists;
  const moved = { ...row, completed };
  return completed
    ? { open: lists.open.filter(t => t.id !== id), completed: [moved, ...lists.completed] }
    : { open: [moved, ...lists.open], completed: lists.completed.filter(t => t.id !== id) };
}

export const withRevision = (lists: TaskLists, id: string, revision: number): TaskLists => {
  const set = (list: TaskRow[]) => list.map(t => (t.id === id ? { ...t, revision } : t));
  return { open: set(lists.open), completed: set(lists.completed) };
};

export const withoutTask = (lists: TaskLists, id: string): TaskLists =>
  ({ open: lists.open.filter(t => t.id !== id), completed: lists.completed.filter(t => t.id !== id) });

export type DueInfo = { text: string; overdue: boolean } | null;

/** A due date past today is shown in words and date only: no alerts, no priority (DESIGN S09). */
export function dueInfo(dueDate: IsoDate | null, today: IsoDate, completed: boolean): DueInfo {
  if (!dueDate) return null;
  const date = format.date(dueDate);
  if (!completed && dueDate < today) return { text: `עבר היעד · ${date}`, overdue: true };
  return { text: `יעד ${date}`, overdue: false };
}

export type TaskDraft = { body: string; dueDate: string };
export type DraftResult = { ok: true; body: string; dueDate: IsoDate | null } | { ok: false; errors: { body?: string; dueDate?: string } };

export function parseDraft(draft: TaskDraft): DraftResult {
  const errors: { body?: string; dueDate?: string } = {};
  const body = draft.body.trim();
  if (!body) errors.body = 'יש לכתוב את תוכן המשימה';
  else if (body.length > MAX_BODY) errors.body = `המשימה ארוכה מדי: עד ${MAX_BODY} תווים`;
  const due = draft.dueDate.trim();
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) errors.dueDate = 'תאריך לא תקין';
  if (errors.body || errors.dueDate) return { ok: false, errors };
  return { ok: true, body, dueDate: (due || null) as IsoDate | null };
}

export const draftOf = (task: TaskRow | null): TaskDraft => ({ body: task?.body ?? '', dueDate: task?.dueDate ?? '' });
