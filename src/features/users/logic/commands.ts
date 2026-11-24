import 'server-only';
import type { Platform, UsersApi } from '@/types/contracts';
import { UsersApiInputSchemas } from '@/types/contracts/schemas';
import { failure } from '@/lib/db/rpc';
import { z } from 'zod';
import { ownerOperation } from './shared';

/** Promote or demote an admin (owner-level account). Not in the shared UsersApi contract yet: kept local to this feature. */
export const SetOwnerLevelSchema = z.strictObject({ userId: z.uuid(), enabled: z.boolean(), expectedRevision: z.number().int().positive() });
export type SetOwnerLevelInput = z.infer<typeof SetOwnerLevelSchema>;

export function createUserCommands(platform: Platform) {
  return {
    createUser: ownerOperation(platform, UsersApiInputSchemas.createUser, async (ctx, input) => {
      const created = await platform.authAdmin.createUser(ctx, input);
      if (!created.ok) return created;
      const { data, error } = await ctx.db.from('profiles').select('id,revision').eq('id', created.value.userId).maybeSingle();
      if (error) throw error;
      return data ? { ok: true as const, value: { id: data.id, revision: data.revision } } : failure('UNAVAILABLE');
    }),
    // AuthAdmin.setEmail updates name and email atomically against expectedRevision (P1.3-PROFILE-UPDATE).
    updateUser: ownerOperation(platform, UsersApiInputSchemas.updateUser, (ctx, input) => platform.authAdmin.setEmail(ctx, { userId: input.id, expectedRevision: input.expectedRevision, fullName: input.fullName, email: input.email })),
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

export function createOwnerLevelCommand(platform: Platform) {
  return {
    setOwnerLevel: ownerOperation(platform, SetOwnerLevelSchema, (ctx, input) => platform.rpc<SetOwnerLevelInput, { id: string; revision: number }>(ctx, 'set_owner_level', input)),
  };
}
