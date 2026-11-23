import { notFound, redirect } from 'next/navigation';
import { SIGN_IN_PATH } from '@/lib/navigation';
import { StateMessage } from '@/components/ui';
import { loadProject } from '@/features/projects/shared/load';
import { createFilesApi } from '@/features/files/logic';
import { FilesProvider } from '@/features/files/shared/FilesProvider';
import { FilesMobile } from '@/features/files/mobile/FilesMobile';
import { FilesDesktop } from '@/features/files/desktop/FilesDesktop';
import '@/features/files/shared/files.css';

export const metadata = { title: 'מסמכים' };

/** Documents of one project. The database decides who sees what; the page only offers controls the live permissions allow. */
export default async function ProjectFilesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { platform, ctx, project } = await loadProject(id);
  const api = createFilesApi(platform);
  const { uploadDocument, manageAccess } = project.permissions;
  const [active, archived, candidates] = await Promise.all([
    api.listDocuments(ctx, { projectId: id }),
    manageAccess ? api.listDocuments(ctx, { projectId: id, archived: true }) : Promise.resolve(null),
    uploadDocument || manageAccess ? api.listAccessCandidates(ctx, { projectId: id }) : Promise.resolve(null),
  ]);
  if (!active.ok) {
    const code = active.error.code;
    if (code === 'NOT_FOUND' || code === 'FORBIDDEN' || code === 'VALIDATION') notFound();
    if (code === 'UNAUTHENTICATED') redirect(SIGN_IN_PATH);
    return <StateMessage tone="error" backHref={`/projects/${id}`} backLabel="חזרה לתיק הפרויקט">המסמכים אינם זמינים כרגע. נסו שוב בעוד רגע.</StateMessage>;
  }
  return (
    <FilesProvider projectId={id} active={active.value.items} archived={archived?.ok ? archived.value.items : []}
      candidates={candidates?.ok ? candidates.value : []} canUpload={uploadDocument} isOwner={manageAccess}>
      <FilesMobile />
      <FilesDesktop />
    </FilesProvider>
  );
}
