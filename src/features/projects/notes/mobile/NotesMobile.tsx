'use client';
import { Button, Notice, Pin } from '@/components/ui';
import { NoteList } from '../shared/NoteList';
import { useNotes } from '../shared/NotesProvider';

/** Phone: one column, new-note button pinned on top, then the notes. */
export function NotesMobile() {
  const { canWrite, openCreate } = useNotes();
  return (
    <div className="nt nt-mobile m-only">
      {canWrite ? <Pin><Button block icon="add" onClick={openCreate}>הערה חדשה</Button></Pin> : <Notice>הפרויקט זמין לצפייה והדפסה בלבד.</Notice>}
      <NoteList empty="עוד אין הערות בפרויקט" />
    </div>
  );
}
