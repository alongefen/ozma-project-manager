'use client';
import { useId, useState } from 'react';
import type { TaskAssignee, TaskRow } from '@/types/contracts';
import { DateField, FormActions, MultiSelectField, Notice } from '@/components/ui';
import { ADMIN_LABEL, ROLE_LABEL } from '@/features/users/shared/view-model';
import { MAX_BODY, draftOf, parseDraft, type TaskDraft } from './model';

/** Note, optional due date and optional assignees (A-46, A-47), one form for both layouts (inside the shared sheet). No reminder. */
export function TaskForm({ task, assignees, busy, error, onSubmit, onCancel }: {
  task: TaskRow | null; assignees: TaskAssignee[]; busy: boolean; error: string | null;
  onSubmit: (fields: { body: string; dueDate: string | null; assigneeIds: string[] }) => void; onCancel: () => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<TaskDraft>(draftOf(task));
  const [errors, setErrors] = useState<{ body?: string; dueDate?: string }>({});
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = parseDraft(draft);
    if (!parsed.ok) { setErrors(parsed.errors); return; }
    setErrors({});
    onSubmit({ body: parsed.body, dueDate: parsed.dueDate, assigneeIds: parsed.assigneeIds });
  }
  return (
    <form className="tk-form" onSubmit={submit} noValidate>
      <div className="ui-field">
        <label className="ui-field__label" htmlFor={`${id}-body`}>תוכן המשימה</label>
        <textarea id={`${id}-body`} className="ui-field__input tk-textarea" rows={5} value={draft.body} autoFocus
          aria-invalid={errors.body ? true : undefined} aria-describedby={`${id}-count`}
          onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} />
        <span id={`${id}-count`} className="ui-field__hint tk-count" aria-live="polite">{draft.body.length} / {MAX_BODY}</span>
        {errors.body && <span className="ui-field__error">{errors.body}</span>}
      </div>
      <DateField label="תאריך יעד (רשות)" value={draft.dueDate} error={errors.dueDate}
        onChange={v => setDraft(d => ({ ...d, dueDate: v }))} />
      <MultiSelectField label="אחראים (רשות)" placeholder="בחירת אחראים" value={draft.assigneeIds}
        options={assignees.map(a => ({ value: a.id, label: a.name, hint: a.isOwner ? ADMIN_LABEL : a.role ? ROLE_LABEL[a.role] : undefined }))}
        onChange={ids => setDraft(d => ({ ...d, assigneeIds: ids }))} />
      {error && <Notice tone="error">{error}</Notice>}
      <FormActions placement="sheet" submitLabel={busy ? 'שומר…' : 'שמירה'} busy={busy} onCancel={onCancel} />
    </form>
  );
}
