import 'server-only';
import type { AuthAdmin, CompleteProfileCreationInput, CreateProfileInput, Db, PrepareProfileUpdateInput, ProfileCreationResult, ProfileUpdateResult, RequestContext, Result, Saved } from '@/types/contracts';
import { AuthAdminInputSchemas, ProfileCreationResultSchema, ProfileUpdateResultSchema } from '@/types/contracts/schemas';
import { permissions } from '@/lib/permissions';
import { failure, mapError, rpc } from '@/lib/db/rpc';

type Options = { admin: () => Db };
const emailTaken = ['email_exists', 'email_address_exists', 'user_already_exists'];
export async function createManagedUser(ctx: RequestContext, input: Parameters<AuthAdmin['createUser']>[1], options: Options): Promise<Result<{ userId: string }>> {
  const owner = await permissions.requireOwner(ctx, {});
  if (!owner.ok) return owner;
  const parsed = AuthAdminInputSchemas.createUser.safeParse({ ...input, email: input.email?.trim().toLowerCase() });
  if (!parsed.success) return failure('VALIDATION');
  try {
    const admin = options.admin().auth.admin;
    const created = await admin.createUser({ email: parsed.data.email, password: parsed.data.password, email_confirm: true });
    if (created.error && !emailTaken.includes(created.error.code ?? '')) return { ok: false, error: mapError(created.error) };
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
async function prepareUpdate(ctx: RequestContext, input: PrepareProfileUpdateInput): Promise<Result<ProfileUpdateResult>> {
  const prepared = await rpc<PrepareProfileUpdateInput, ProfileUpdateResult>(ctx, 'prepare_profile_update', input);
  if (!prepared.ok) return prepared;
  const result = ProfileUpdateResultSchema.safeParse(prepared.value);
  return result.success && result.data.id === input.id.toLowerCase() ? { ok: true, value: result.data } : failure('UNAVAILABLE');
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
      const parsed = AuthAdminInputSchemas.setEmail.safeParse({ ...input, email: typeof input?.email === 'string' ? input.email.trim().toLowerCase() : undefined });
      if (!parsed.success) return failure('VALIDATION');
      const { userId, expectedRevision, fullName, email } = parsed.data;
      const request = { id: userId, expectedRevision, fullName, email };
      const prepared = await prepareUpdate(ctx, request);
      if (!prepared.ok) return prepared;
      const { id, revision, emailPending } = prepared.value;
      if (!emailPending) return { ok: true, value: { id, revision } };

      let authError: unknown;
      try {
        authError = (await options.admin().auth.admin.updateUserById(id, { email, email_confirm: true })).error;
      } catch (error) { authError = error; }
      try {
        const { data: profile, error } = await ctx.db.from('profiles').select('revision').eq('id', id).maybeSingle();
        if (error || !profile) return failure('UNAVAILABLE');
        if (profile.revision !== expectedRevision) {
          // Matching content does not prove Auth changed. The revision cannot return to the expected one,
          // so the same prepare cannot write: it replays the trigger's receipt or conflicts.
          const replay = await prepareUpdate(ctx, request);
          if (!replay.ok) return replay;
          return replay.value.emailPending ? failure('UNAVAILABLE') : { ok: true, value: { id, revision: replay.value.revision } };
        }
      } catch { return failure('UNAVAILABLE'); }
      const code = (authError as { code?: string } | null)?.code ?? '';
      if (emailTaken.includes(code)) return failure('CONFLICT');
      if (code === 'validation_failed' || code === 'email_address_invalid') return failure('VALIDATION', { email: 'יש לבדוק את כתובת האימייל' });
      return authError ? { ok: false, error: mapError(authError) } : failure('UNAVAILABLE');
    },
  };
}
