import { loadProject } from '@/features/projects/shared/load';
import { ProjectDetailsMobile } from '@/features/projects/mobile/ProjectDetailsMobile';
import { ProjectDetailsDesktop } from '@/features/projects/desktop/ProjectDetailsDesktop';

export const metadata = { title: 'תיק פרויקט' };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, project } = await loadProject(id);
  return (
    <>
      <ProjectDetailsMobile d={project} isOwner={ctx.actor.isOwner} />
      <ProjectDetailsDesktop d={project} isOwner={ctx.actor.isOwner} />
    </>
  );
}
