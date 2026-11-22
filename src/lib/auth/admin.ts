import 'server-only';
import { z } from 'zod';
import type { AuthAdmin, Db, RequestContext, Result, Saved } from '@/types/contracts';
import { AuthAdminInputSchemas } from '@/types/contracts/schemas';
import { permissions } from '@/lib/permissions';
import { failure, mapError, rpc } from '@/lib/db/rpc';

type Options = { admin: () => Db };
export async function createManagedUser(ctx: RequestContext, input: { email: string; password: string; fullName: string }, options: Options): Promise<Result<{ userId: string }>> {
  const owner = await permissions.requireOwner(ctx, {});
  if (!owner.ok) return owner;
  const parsed = AuthAdminInputSchemas.createUser.safeParse({ email: input.email?.trim().toLowerCase(), password: input.password });
  if (!parsed.success || !z.string().trim().min(1).max(120).safeParse(input.fullName).success) return failure('VALIDATION');
  try {
    const admin = options.admin().auth.admin;
    const created = await admin.createUser({ ...parsed.data, email_confirm: true });
    if (created.error && !['email_exists', 'email_address_exists', 'user_already_exists'].includes(created.error.code ?? '')) return { ok: false, error: mapError(created.error) };
    let userId = created.data.user?.id;
    if (!userId) {
      for (let page = 1; ; page++) {
        const listed = await admin.listUsers({ page, perPage: 1000 });
        if (listed.error) return { ok: false, error: mapError(listed.error) };
        userId = listed.data.users.find(user => user.email?.toLowerCase() === parsed.data.email)?.id;
        if (userId || listed.data.users.length < 1000) break;
      }
    }
    if (!userId) return failure('UNAVAILABLE');
    // This atomic RPC is the ownership claim: a pre-existing profile fails before any password reset.
    const profile = await rpc<{ email: string; fullName: string }, Saved>(ctx, 'create_profile', { email: parsed.data.email, fullName: input.fullName.trim() });
    if (!profile.ok) return profile;
    if (profile.value.id !== userId) return failure('CONFLICT');
    if (created.error) {
      const reset = await admin.updateUserById(userId, { password: parsed.data.password });
      if (reset.error) return { ok: false, error: mapError(reset.error) };
      const revoked = await rpc(ctx, 'revoke_user_sessions', { id: userId });
      if (!revoked.ok) return revoked;
    }
    return { ok: true, value: { userId } };
  } catch { return failure('UNAVAILABLE'); }
}
export function createAuthAdmin(options: Options): AuthAdmin {
  return {
    // The frozen Platform contract has no fullName; UsersApi can call createManagedUser with the supplied name.
    createUser: (ctx, input) => createManagedUser(ctx, { ...input, fullName: input.email?.trim().toLowerCase() }, options),
    async setPassword(ctx, input) {
      const owner = await permissions.requireOwner(ctx, {}); if (!owner.ok) return owner;
      const parsed = AuthAdminInputSchemas.setPassword.safeParse(input); if (!parsed.success) return failure('VALIDATION');
      try {
        const { error } = await options.admin().auth.admin.updateUserById(input.userId, { password: input.password });
        if (error) return { ok: false, error: mapError(error) };
        return rpc(ctx, 'revoke_user_sessions', { id: input.userId });
      } catch { return failure('UNAVAILABLE'); }
    },
    async setEmail(ctx, input) {
      const owner = await permissions.requireOwner(ctx, {}); if (!owner.ok) return owner;
      const parsed = AuthAdminInputSchemas.setEmail.safeParse({ ...input, email: input.email?.trim().toLowerCase() });
      if (!parsed.success) return failure('VALIDATION');
      try {
        const { data: profile, error: readError } = await ctx.db.from('profiles').select('full_name,revision').eq('id', input.userId).maybeSingle();
        if (readError) return { ok: false, error: mapError(readError) };
        if (!profile) return failure('NOT_FOUND');
        const { error } = await options.admin().auth.admin.updateUserById(input.userId, { email: parsed.data.email, email_confirm: true });
        if (error) return { ok: false, error: mapError(error) };
        const saved = await rpc(ctx, 'update_profile', { id: input.userId, expectedRevision: profile.revision, fullName: profile.full_name, email: parsed.data.email });
        return saved.ok ? { ok: true, value: null } : saved;
      } catch { return failure('UNAVAILABLE'); }
    },
  };
}
