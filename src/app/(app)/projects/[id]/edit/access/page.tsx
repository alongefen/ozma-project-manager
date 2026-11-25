import { Page, PageHeader, StateMessage } from '@/components/ui';
import { loadProject, pageContext } from '@/features/projects/shared/load';
import { AccessManager } from '@/features/projects/shared/AccessManager';
import { createUsersApi } from '@/features/users/logic';

export const metadata = { title: 'הרשאות' };

/** Only the owner adds or removes access (A-06). Everyone else sees a plain message and no data. */
export default async function AccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // One stage, not three: identity is memoised per request, so the project and both lists load together.
  const { platform, ctx } = await pageContext();
  const denied = <StateMessage tone="error" backHref={`/projects/${id}`} backLabel="חזרה לתיק הפרויקט">רק מנהל המערכת יכול לשייך אנשים לפרויקט.</StateMessage>;
  if (!ctx.actor.isOwner) return denied;
  const users = createUsersApi(platform);
  const [{ project }, members, everyone] = await Promise.all([loadProject(id), users.listProjectMembers(ctx, { projectId: id }), users.listUsers(ctx, {})]);
  if (!project.permissions.manageAccess) return denied;
  if (!members.ok || !everyone.ok) throw new Error('access unavailable');
  const memberIds = new Set(members.value.map(m => m.userId));
  const candidates = everyone.value.filter(u => u.isActive && !u.isOwner && !memberIds.has(u.id)).map(u => ({ id: u.id, fullName: u.fullName }));
  const admins = everyone.value.filter(u => u.isOwner && u.isActive).map(u => u.fullName);
  return (
    <Page narrow>
      <PageHeader title="הרשאות" sub={project.name} backHref={`/projects/${id}`} backLabel="חזרה לתיק הפרויקט" />
      <AccessManager projectId={id} members={members.value} candidates={candidates} admins={admins} />
    </Page>
  );
}
