import 'server-only';
import type { Actor, PermissionService, ProjectPermissions } from '@/types/contracts';
import { rpc, failure } from '@/lib/db/rpc';
const NO_ACCESS: ProjectPermissions = {
  view: false, editDetails: false, uploadDocument: false, manageAccess: false, writeTasks: false,
  deleteTasks: false, report: false, viewFinance: false, writeFinance: false, cancelTransaction: false,
};

export const permissions: PermissionService = {
  // CLIENT-FEEDBACK-A item 6: only owner-level accounts see finished projects. The database still lets
  // managers and workers read them (X06), so the application layer closes every project-scoped read here.
  async forProject(ctx, input) {
    const result = await rpc<{ projectId: string }, ProjectPermissions>(ctx, 'project_permissions', input);
    if (!result.ok || ctx.actor.isOwner || !result.value.view) return result;
    const project = await ctx.db.from('projects').select('status').eq('id', input.projectId).maybeSingle();
    if (project.error) return failure('UNAVAILABLE');
    return project.data?.status === 'completed' ? { ok: true, value: NO_ACCESS } : result;
  },
  async requireOwner(ctx) {
    const actor = await rpc<Record<string, never>, Actor | null>(ctx, 'get_actor', {});
    if (!actor.ok) return actor;
    if (!actor.value) return failure('UNAUTHENTICATED');
    return actor.value.isOwner ? { ok: true, value: null } : failure('FORBIDDEN');
  },
};
