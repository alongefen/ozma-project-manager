import 'server-only';
import type { AuthAdmin, CompleteProfileCreationInput, CreateProfileInput, Db, ProfileCreationResult, RequestContext, Result, Saved } from '@/types/contracts';
import { AuthAdminInputSchemas, ProfileCreationResultSchema } from '@/types/contracts/schemas';
import { permissions } from '@/lib/permissions';
import { failure, mapError, rpc } from '@/lib/db/rpc';

type Options = { admin: () => Db };
export async function createManagedUser(ctx: RequestContext, input: Parameters<AuthAdmin['createUser']>[1], options: Options): Promise<Result<{ userId: string }>> {
  const owner = await permissions.requireOwner(ctx, {});
  if (!owner.ok) return owner;
  const parsed = AuthAdminInputSchemas.createUser.safeParse({ ...input, email: input.email?.trim().toLowerCase() });
  if (!parsed.success) return failure('VALIDATION');
  try {
    const admin = options.admin().auth.admin;
    const created = await admin.createUser({ email: parsed.data.email, password: parsed.data.password, email_confirm: true });
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
    // The server receipt authorizes only this owner's matching request, never an arbitrary existing account.
    const profile = await rpc<CreateProfileInput, ProfileCreationResult>(ctx, 'create_profile', {
      requestId: parsed.data.requestId, email: parsed.data.email, fullName: parsed.data.fullName,
    });
    if (!profile.ok) return profile;
    if (!ProfileCreationResultSchema.safeParse(profile.value).success) return failure('UNAVAILABLE');
    if (profile.value.id !== userId) return failure('CONFLICT');
    // A lost completion response must not replay the password change or session revocation.
    if (!profile.value.passwordPending) return { ok: true, value: { userId } };
    if (created.error) {
      const reset = await admin.updateUserById(userId, { password: parsed.data.password });
      if (reset.error) return { ok: false, error: mapError(reset.error) };
    }
    // New Auth users already have the requested password. Completion atomically records it and revokes early sessions.
    const completed = await rpc<CompleteProfileCreationInput, Saved>(ctx, 'complete_profile_creation', { requestId: parsed.data.requestId, userId });
    if (!completed.ok) return completed;
    return { ok: true, value: { userId } };
  } catch { return failure('UNAVAILABLE'); }
}
export function createAuthAdmin(options: Options): AuthAdmin {
  return {
    createUser: (ctx, input) => createManagedUser(ctx, input, options),
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
