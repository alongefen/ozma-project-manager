import { Page, PageHeader, StateMessage } from '@/components/ui';
import { loadProject } from '@/features/projects/shared/load';
import { AccessManager } from '@/features/projects/shared/AccessManager';
import { createUsersApi } from '@/features/users/logic';

export const metadata = { title: 'הרשאות' };

/** Only the owner adds or removes access (A-06). Everyone else sees a plain message and no data. */
export default async function AccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { platform, ctx, project } = await loadProject(id);
  if (!ctx.actor.isOwner || !project.permissions.manageAccess) {
    return <StateMessage tone="error" backHref={`/projects/${id}`} backLabel="חזרה לתיק הפרויקט">רק מנהל המערכת יכול לשייך אנשים לפרויקט.</StateMessage>;
  }
  const users = createUsersApi(platform);
  const [members, everyone] = await Promise.all([users.listProjectMembers(ctx, { projectId: id }), users.listUsers(ctx, {})]);
  if (!members.ok || !everyone.ok) throw new Error('access unavailable');
  const memberIds = new Set(members.value.map(m => m.userId));
  const candidates = everyone.value.filter(u => u.isActive && !u.isOwner && !memberIds.has(u.id)).map(u => ({ id: u.id, fullName: u.fullName }));
  return (
    <Page narrow>
      <PageHeader title="הרשאות" sub={project.name} backHref={`/projects/${id}`} backLabel="חזרה לתיק הפרויקט" />
      <AccessManager projectId={id} members={members.value} candidates={candidates} />
    </Page>
  );
}
