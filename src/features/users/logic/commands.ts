import 'server-only';
import type { Platform, Result, UsersApi } from '@/types/contracts';
import { UsersApiInputSchemas } from '@/types/contracts/schemas';
import { failure } from '@/lib/db/rpc';
import { z } from 'zod';
import { ownerOperation } from './shared';

/** Promote or demote an admin (owner-level account). Not in the shared UsersApi contract yet: kept local to this feature. */
export const SetOwnerLevelSchema = z.strictObject({ userId: z.uuid(), enabled: z.boolean(), expectedRevision: z.number().int().positive() });
export type SetOwnerLevelInput = z.infer<typeof SetOwnerLevelSchema>;

/** HIDE-TECH-ADMINS: flag an admin as technical (not an assignee option). Local to this feature, like `setOwnerLevel`. */
export const SetTechnicalAdminSchema = z.strictObject({ userId: z.uuid(), enabled: z.boolean(), expectedRevision: z.number().int().positive() });
export type SetTechnicalAdminInput = z.infer<typeof SetTechnicalAdminSchema>;

/** Item 1 of CLIENT-FEEDBACK-A: add one person to every open project at once. Local to this feature, like `setOwnerLevel`. */
export const AddToAllProjectsSchema = z.strictObject({ userId: z.uuid(), role: z.enum(['manager', 'worker']) });
export type AddToAllProjectsInput = z.infer<typeof AddToAllProjectsSchema>;
export type AddToAllProjectsResult = { added: number; alreadyMember: number; failed: number };

export function createBulkAccessCommand(platform: Platform) {
  return {
    addToAllProjects: ownerOperation(platform, AddToAllProjectsSchema, async (ctx, input): Promise<Result<AddToAllProjectsResult>> => {
      const person = await ctx.db.from('profiles').select('is_owner,is_active').eq('id', input.userId).maybeSingle();
      if (person.error) throw person.error;
      if (!person.data) return failure('NOT_FOUND');
      if (person.data.is_owner || !person.data.is_active) return failure('VALIDATION');
      const projects = await platform.fetchAll(async (from, to) => {
        const { data, error } = await ctx.db.from('projects').select('id').eq('status', 'active').is('archived_at', null).order('id').range(from, to);
        if (error) throw error;
        return data ?? [];
      });
      const existing = await platform.fetchAll(async (from, to) => {
        const { data, error } = await ctx.db.from('memberships').select('project_id').eq('user_id', input.userId).order('project_id').range(from, to);
        if (error) throw error;
        return data ?? [];
      });
      const member = new Set(existing.map(row => row.project_id));
      const todo = projects.filter(p => !member.has(p.id));
      let added = 0, failed = 0;
      // One membership at a time through the existing function; an existing role is never changed and finance stays off.
      for (const project of todo) {
        const result = await platform.rpc(ctx, 'set_membership', { userId: input.userId, projectId: project.id, role: input.role, expectedRevision: null });
        if (result.ok) added += 1; else failed += 1;
      }
      return { ok: true, value: { added, alreadyMember: projects.length - todo.length, failed } };
    }),
  };
}

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

export function createTechnicalAdminCommand(platform: Platform) {
  return {
    setTechnicalAdmin: ownerOperation(platform, SetTechnicalAdminSchema, (ctx, input) => platform.rpc<SetTechnicalAdminInput, { id: string; revision: number }>(ctx, 'set_technical_admin', input)),
  };
}
