import Link from 'next/link';
import { Card, Notice } from '@/components/ui';
import { loadProject } from '@/features/projects/shared/load';
import { ProjectForm } from '@/features/projects/shared/ProjectForm';
import { CoverControl } from '@/features/projects/shared/CoverControl';
import { valuesFromDetails } from '@/features/projects/shared/form-model';
import { actionsFor } from '@/features/projects/shared/view-model';

export const metadata = { title: 'עריכת פרטים' };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, project } = await loadProject(id);
  const act = actionsFor(project);
  if (!act.edit) {
    return (
      <div>
        <Notice>אי אפשר לערוך את הפרויקט במצבו הנוכחי או בלי הרשאה.</Notice>
        <p><Link href={`/projects/${id}`}>חזרה לתיק הפרויקט</Link></p>
      </div>
    );
  }
  return (
    <>
      <h1 className="ui-page-title d-only">עריכת פרטים: {project.name}</h1>
      <div style={{ display: 'grid', gap: 16 }}>
        {act.manage && (
          <Card panel>
            <h2 style={{ fontSize: 19, fontWeight: 800, marginBottom: 12 }}>תמונת שער</h2>
            <CoverControl id={project.id} revision={project.revision} coverFileId={project.coverFileId} />
          </Card>
        )}
        <ProjectForm mode="edit" isOwner={ctx.actor.isOwner} projectId={project.id} revision={project.revision} initial={valuesFromDetails(project)} />
      </div>
    </>
  );
}
