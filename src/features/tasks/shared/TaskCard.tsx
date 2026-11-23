'use client';
import type { TaskRow } from '@/types/contracts';
import { Button } from '@/components/ui';
import { dueInfo } from './model';
import { useTasks } from './TasksProvider';

/** One note: big tick, text, due date in words, edit and (owner only) remove. Same card on phone and desktop. */
export function TaskCard({ task }: { task: TaskRow }) {
  const { canWrite, canDelete, today, busy, toggle, openEdit, askDelete } = useTasks();
  const due = dueInfo(task.dueDate, today, task.completed);
  const pending = busy.has(task.id);
  return (
    <li className={`tk-card${task.completed ? ' tk-card--done' : ''}`}>
      <label className="tk-check">
        <input type="checkbox" checked={task.completed} disabled={!canWrite || pending} onChange={() => toggle(task)} aria-label={task.completed ? 'סימון כלא בוצע' : 'סימון כבוצע'} />
        <span className="tk-check__box" aria-hidden="true" />
      </label>
      <div className="tk-card__main">
        <p className="tk-card__body">{task.body}</p>
        {due && <p className={`tk-card__due${due.overdue ? ' tk-card__due--late' : ''}`}>{due.text}</p>}
      </div>
      {canWrite && (
        <div className="tk-card__actions">
          <Button variant="secondary" size="small" onClick={() => openEdit(task)} disabled={pending}>עריכה</Button>
          {canDelete && <Button variant="secondary" size="small" onClick={() => askDelete(task)} disabled={pending}>מחיקה</Button>}
        </div>
      )}
    </li>
  );
}
