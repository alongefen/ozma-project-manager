import 'server-only';
import type { Actor, PermissionService } from '@/types/contracts';
import { rpc, failure } from '@/lib/db/rpc';
export const permissions: PermissionService = {
  forProject: (ctx, input) => rpc(ctx, 'project_permissions', input),
  async requireOwner(ctx) {
    const actor = await rpc<Record<string, never>, Actor | null>(ctx, 'get_actor', {});
    if (!actor.ok) return actor;
    if (!actor.value) return failure('UNAUTHENTICATED');
    return actor.value.isOwner ? { ok: true, value: null } : failure('FORBIDDEN');
  },
};
