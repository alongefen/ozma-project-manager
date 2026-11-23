import { Page, StateMessage } from '@/components/ui';
import { pageContext } from '@/features/projects/shared/load';
import { NewProjectWizard } from '@/features/projects/shared/NewProjectWizard';

export const metadata = { title: 'פרויקט חדש' };

/**
 * Deep link into the "new project" window. The window itself is `NewProjectWizard`, which the projects
 * list mounts behind its "פרויקט חדש" button; this route opens it directly and returns to the list on close.
 * Creating a project is the owner's action; anyone else gets a plain message, never the form.
 */
export default async function NewProjectPage() {
  const { ctx } = await pageContext();
  if (!ctx.actor.isOwner) {
    return <StateMessage tone="error" backHref="/projects" backLabel="חזרה לפרויקטים">רק מנהל המערכת יכול ליצור פרויקט.</StateMessage>;
  }
  return <Page narrow><NewProjectWizard defaultOpen closeHref="/projects" /></Page>;
}
