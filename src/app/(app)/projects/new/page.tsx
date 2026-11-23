import { Page, PageHeader, StateMessage } from '@/components/ui';
import { pageContext } from '@/features/projects/shared/load';
import { ProjectForm } from '@/features/projects/shared/ProjectForm';

export const metadata = { title: 'פרויקט חדש' };

/** Creating a project is the owner's action; anyone else gets a plain message, never the form. */
export default async function NewProjectPage() {
  const { ctx } = await pageContext();
  if (!ctx.actor.isOwner) {
    return <StateMessage tone="error" backHref="/projects" backLabel="חזרה לפרויקטים">רק מנהל המערכת יכול ליצור פרויקט.</StateMessage>;
  }
  return (
    <Page narrow>
      <PageHeader title="פרויקט חדש" backHref="/projects" backLabel="חזרה לרשימת הפרויקטים" />
      <ProjectForm mode="create" isOwner />
    </Page>
  );
}
