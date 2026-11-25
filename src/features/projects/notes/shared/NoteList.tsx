'use client';
import { DeleteIcon, EditIcon, IconButton } from '@/components/ui';
import { format } from '@/lib/format';
import { canChange } from './model';
import { useNotes } from './NotesProvider';

/** Notes newest first: who wrote it, when, the text; edit and cancel only for the author or an owner-level account. */
export function NoteList({ empty }: { empty: string }) {
  const { notes, canWrite, viewerId, isOwner, openEdit, askCancel } = useNotes();
  if (!notes.length) return <p className="nt-empty">{empty}</p>;
  return (
    <ul className="nt-list">
      {notes.map(n => (
        <li key={n.id} className="nt-card">
          <p className="nt-card__meta">
            <span className="nt-card__who">{n.authorName}</span>
            <span className="nt-card__when">{format.dateTime(n.createdAt as never)}</span>
            {n.editedAt && <span className="nt-card__when">נערכה {format.dateTime(n.editedAt as never)}</span>}
          </p>
          <p className="nt-card__body">{n.body}</p>
          {canChange(n, viewerId, isOwner, canWrite) && (
            <div className="nt-card__actions">
              <IconButton tone="danger" label={`ביטול הערה של ${n.authorName}`} onClick={() => askCancel(n)}><DeleteIcon /></IconButton>
              <IconButton label={`עריכת הערה של ${n.authorName}`} onClick={() => openEdit(n)}><EditIcon /></IconButton>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
