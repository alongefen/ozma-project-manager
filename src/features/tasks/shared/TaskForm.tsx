'use client';
import { useId, useState } from 'react';
import type { TaskAssignee, TaskRow } from '@/types/contracts';
import { DateField, FormActions, Notice, SelectField } from '@/components/ui';
import { MAX_BODY, draftOf, parseDraft, type TaskDraft } from './model';

/** Note, optional due date and optional assignee (A-46), one form for both layouts (inside the shared sheet). No reminder. */
export function TaskForm({ task, assignees, busy, error, onSubmit, onCancel }: {
  task: TaskRow | null; assignees: TaskAssignee[]; busy: boolean; error: string | null;
  onSubmit: (fields: { body: string; dueDate: string | null; assigneeId: string | null }) => void; onCancel: () => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<TaskDraft>(draftOf(task));
  const [errors, setErrors] = useState<{ body?: string; dueDate?: string }>({});
  // A person who left the project stays listed only while they are the current value; an unchanged value is not sent, so editing the text still works.
  const options = [
    { value: '', label: 'ללא אחראי' },
    ...(task?.assigneeId && !assignees.some(a => a.id === task.assigneeId) ? [{ value: task.assigneeId, label: 'אחראי לשעבר' }] : []),
    ...assignees.map(a => ({ value: a.id, label: a.name })),
  ];
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = parseDraft(draft);
    if (!parsed.ok) { setErrors(parsed.errors); return; }
    setErrors({});
    onSubmit({ body: parsed.body, dueDate: parsed.dueDate, assigneeId: parsed.assigneeId });
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
      <SelectField label="אחראי (רשות)" value={draft.assigneeId} onChange={v => setDraft(d => ({ ...d, assigneeId: v }))} options={options} />
      {error && <Notice tone="error">{error}</Notice>}
      <FormActions placement="sheet" submitLabel={busy ? 'שומר…' : 'שמירה'} busy={busy} onCancel={onCancel} />
    </form>
  );
}
