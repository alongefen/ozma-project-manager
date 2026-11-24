import { redirect } from 'next/navigation';
import { DesktopTitle, StateMessage } from '@/components/ui';
import { getContext, getPlatform } from '@/components/shell/request';
import { SIGN_IN_PATH } from '@/lib/navigation';
import { createUsersApi } from '@/features/users/logic';
import { createProjectsApi } from '@/features/projects/logic';
import { UsersManager } from '@/features/users/shared/UsersManager';

export const metadata = { title: 'עובדים והרשאות' };

/** Only the owner adds or removes access (A-06): everyone else gets a plain message and no data. */
export default async function UsersPage() {
  const [platform, context] = await Promise.all([getPlatform(), getContext()]);
  if (!context.ok) {
    if (context.error.code === 'UNAUTHENTICATED') redirect(SIGN_IN_PATH);
    throw new Error('context unavailable');
  }
  const ctx = context.value;
  if (!ctx.actor.isOwner) return <StateMessage tone="error" backHref="/projects" backLabel="חזרה לפרויקטים">רק אדמין יכול לנהל אנשים והרשאות.</StateMessage>;
  const [users, projects] = await Promise.all([createUsersApi(platform).listUsers(ctx, {}), createProjectsApi(platform).listProjects(ctx, { archived: false })]);
  if (!users.ok || !projects.ok) throw new Error('users unavailable');
  return (
    <>
      <DesktopTitle title="עובדים והרשאות" />
      <UsersManager users={users.value} projects={projects.value} viewerId={ctx.actor.userId} />
    </>
  );
}
