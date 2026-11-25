import { notFound, redirect } from 'next/navigation';
import { getContext, getPlatform } from '@/components/shell/request';
import { SIGN_IN_PATH } from '@/lib/navigation';
import { StateMessage } from '@/components/ui';
import { createNotesApi } from '@/features/projects/notes/logic';
import { NotesProvider } from '@/features/projects/notes/shared/NotesProvider';
import { NotesMobile } from '@/features/projects/notes/mobile/NotesMobile';
import { NotesDesktop } from '@/features/projects/notes/desktop/NotesDesktop';
import '@/features/projects/notes/shared/notes.css';

export const metadata = { title: 'הערות' };

/** Notes of one project, newest first. Write controls follow the live permission; the database decides. */
export default async function ProjectNotesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [platform, context] = await Promise.all([getPlatform(), getContext()]);
  if (!context.ok) redirect(SIGN_IN_PATH);
  const result = await createNotesApi(platform).listNotes(context.value, { projectId: id });
  if (!result.ok) {
    const code = result.error.code;
    if (code === 'NOT_FOUND' || code === 'FORBIDDEN' || code === 'VALIDATION') notFound();
    if (code === 'UNAUTHENTICATED') redirect(SIGN_IN_PATH);
    return <StateMessage tone="error" backHref={`/projects/${id}`} backLabel="חזרה לתיק הפרויקט">ההערות אינן זמינות כרגע. נסו שוב בעוד רגע.</StateMessage>;
  }
  return (
    <NotesProvider projectId={id} initial={result.value}>
      <NotesMobile />
      <NotesDesktop />
    </NotesProvider>
  );
}
