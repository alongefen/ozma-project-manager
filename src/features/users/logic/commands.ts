import 'server-only';
import type { Platform, UsersApi } from '@/types/contracts';
import { UsersApiInputSchemas } from '@/types/contracts/schemas';
import { failure } from '@/lib/db/rpc';
import { ownerOperation } from './shared';

export function createUserCommands(platform: Platform) {
  return {
    createUser: ownerOperation(platform, UsersApiInputSchemas.createUser, async (ctx, input) => {
      const created = await platform.authAdmin.createUser(ctx, input);
      if (!created.ok) return created;
      const { data, error } = await ctx.db.from('profiles').select('id,revision').eq('id', created.value.userId).maybeSingle();
      if (error) throw error;
      return data ? { ok: true as const, value: { id: data.id, revision: data.revision } } : failure('UNAVAILABLE');
    }),
    updateUser: ownerOperation(platform, UsersApiInputSchemas.updateUser, async (ctx, input) => {
      const { data, error } = await ctx.db.from('profiles').select('id,email,revision').eq('id', input.id).maybeSingle();
      if (error) throw error;
      if (!data) return failure('NOT_FOUND');
      if (data.revision !== input.expectedRevision) return failure('CONFLICT');
      const email = input.email.toLowerCase();
      // Shared AuthAdmin.setEmail cannot honor the edit revision atomically.
      // Keep email changes unavailable until the coordinated shared fix lands.
      if (email !== data.email.toLowerCase()) return failure('UNAVAILABLE');
      return platform.rpc(ctx, 'update_profile', { ...input, email });
    }),
    setUserActive: ownerOperation(platform, UsersApiInputSchemas.setUserActive, (ctx, input) => platform.rpc(ctx, 'set_user_active', input)),
    resetPassword: ownerOperation(platform, UsersApiInputSchemas.resetPassword, (ctx, input) => platform.authAdmin.setPassword(ctx, { userId: input.id, password: input.password })),
    setMembership: ownerOperation(platform, UsersApiInputSchemas.setMembership, (ctx, input) => platform.rpc(ctx, 'set_membership', input)),
    removeMembership: ownerOperation(platform, UsersApiInputSchemas.removeMembership, (ctx, input) => platform.rpc(ctx, 'remove_membership', input)),
    setFinanceAccess: ownerOperation(platform, UsersApiInputSchemas.setFinanceAccess, async (ctx, input) => {
      const result = await platform.rpc<typeof input, { revision: number; financeAccess: boolean }>(ctx, 'set_finance_access', input);
      return result.ok ? { ok: true as const, value: { revision: result.value.revision } } : result;
    }),
  } satisfies Pick<UsersApi, 'createUser' | 'updateUser' | 'setUserActive' | 'resetPassword' | 'setMembership' | 'removeMembership' | 'setFinanceAccess'>;
}
