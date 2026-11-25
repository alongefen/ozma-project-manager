'use client';
import { Button, Card, Notice, Pin } from '@/components/ui';
import { NoteList } from '../shared/NoteList';
import { useNotes } from '../shared/NotesProvider';

/** Desktop: pinned bar with the new-note button, then the notes in one panel. */
export function NotesDesktop() {
  const { canWrite, openCreate } = useNotes();
  return (
    <div className="nt nt-desktop d-only">
      {canWrite && <Pin className="nt-bar"><Button className="ui-lead" icon="add" onClick={openCreate}>הערה חדשה</Button></Pin>}
      {!canWrite && <Notice>הפרויקט זמין לצפייה והדפסה בלבד.</Notice>}
      <Card panel><NoteList empty="עוד אין הערות בפרויקט" /></Card>
    </div>
  );
}
