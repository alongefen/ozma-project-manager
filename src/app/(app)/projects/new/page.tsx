import Link from 'next/link';
import { Notice } from '@/components/ui';
import { pageContext } from '@/features/projects/shared/load';
import { ProjectForm } from '@/features/projects/shared/ProjectForm';

export const metadata = { title: 'פרויקט חדש' };

/** Creating a project is the owner's action; anyone else gets a plain message, never the form. */
export default async function NewProjectPage() {
  const { ctx } = await pageContext();
  if (!ctx.actor.isOwner) {
    return (
      <div>
        <Notice tone="error">רק מנהל המערכת יכול ליצור פרויקט.</Notice>
        <p><Link href="/projects">חזרה לפרויקטים</Link></p>
      </div>
    );
  }
  return (
    <>
      <h1 className="ui-page-title d-only">פרויקט חדש</h1>
      <ProjectForm mode="create" isOwner />
    </>
  );
}
