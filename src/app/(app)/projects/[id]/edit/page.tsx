import { Card, Page, PageHeader, StateMessage } from '@/components/ui';
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
    return <StateMessage backHref={`/projects/${id}`} backLabel="חזרה לתיק הפרויקט">אי אפשר לערוך את הפרויקט במצבו הנוכחי או בלי הרשאה.</StateMessage>;
  }
  return (
    <Page narrow>
      <PageHeader title="עריכת פרטים" sub={project.name} backHref={`/projects/${id}`} backLabel="חזרה לתיק הפרויקט" />
        {act.manage && (
          <Card panel>
            <h2 className="ui-card__title">תמונת שער</h2>
            <CoverControl id={project.id} revision={project.revision} coverFileId={project.coverFileId} />
          </Card>
        )}
        <ProjectForm mode="edit" isOwner={ctx.actor.isOwner} projectId={project.id} revision={project.revision} initial={valuesFromDetails(project)} />
    </Page>
  );
}
