import { loadProject } from '@/features/projects/shared/load';
import { ProjectDetailsMobile } from '@/features/projects/mobile/ProjectDetailsMobile';
import { createContactsApi } from '@/features/projects/contacts/logic';
import { ProjectDetailsDesktop } from '@/features/projects/desktop/ProjectDetailsDesktop';

export const metadata = { title: 'תיק פרויקט' };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { platform, ctx, project } = await loadProject(id);
  const extra = await createContactsApi(platform).listContacts(ctx, { projectId: id });
  const contacts = extra.ok ? extra.value : { contacts: [], canWrite: false };
  return (
    <>
      <ProjectDetailsMobile d={project} isOwner={ctx.actor.isOwner} contacts={contacts} />
      <ProjectDetailsDesktop d={project} isOwner={ctx.actor.isOwner} contacts={contacts} />
    </>
  );
}
