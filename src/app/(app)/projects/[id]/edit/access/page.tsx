import Link from 'next/link';
import { Notice } from '@/components/ui';
import { loadProject } from '@/features/projects/shared/load';
import { BackTitle } from '@/features/projects/shared/BackTitle';
import { AccessManager } from '@/features/projects/shared/AccessManager';
import { createUsersApi } from '@/features/users/logic';

export const metadata = { title: 'הרשאות' };

/** Only the owner adds or removes access (A-06). Everyone else sees a plain message and no data. */
export default async function AccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { platform, ctx, project } = await loadProject(id);
  if (!ctx.actor.isOwner || !project.permissions.manageAccess) {
    return (
      <div>
        <Notice tone="error">רק מנהל המערכת יכול לשייך אנשים לפרויקט.</Notice>
        <p><Link href={`/projects/${id}`}>חזרה לתיק הפרויקט</Link></p>
      </div>
    );
  }
  const users = createUsersApi(platform);
  const [members, everyone] = await Promise.all([users.listProjectMembers(ctx, { projectId: id }), users.listUsers(ctx, {})]);
  if (!members.ok || !everyone.ok) throw new Error('access unavailable');
  const memberIds = new Set(members.value.map(m => m.userId));
  const candidates = everyone.value.filter(u => u.isActive && !u.isOwner && !memberIds.has(u.id)).map(u => ({ id: u.id, fullName: u.fullName }));
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 820 }}>
      <BackTitle title="הרשאות" backHref={`/projects/${id}`} backLabel="חזרה לתיק הפרויקט" />
      <p className="ui-sub" style={{ marginTop: -8 }}>{project.name}</p>
      <AccessManager projectId={id} members={members.value} candidates={candidates} />
    </div>
  );
}
