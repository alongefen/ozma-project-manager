import 'server-only';
import { z } from 'zod';
import type { Db, Platform, RequestContext, Result } from '@/types/contracts';
import { headers } from 'next/headers';
import { createAuthClient, createPrivilegedClient, trustedClientIp } from '@/lib/db/clients';
import { failure, mapError } from '@/lib/db/rpc';

export const MIN_PASSWORD = 8;
export const ChangePasswordSchema = z.strictObject({ currentPassword: z.string().min(1).max(1024), newPassword: z.string().min(MIN_PASSWORD).max(1024) });
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export const ChangeNameSchema = z.strictObject({ fullName: z.string().trim().min(1).max(120) });
export type ChangeNameInput = z.infer<typeof ChangeNameSchema>;

export type PasswordDeps = {
  /** Service client used only to check the current password (nothing is persisted on it). */
  authClient: Db;
  /** Privileged client: sets the password and signs out the person's other sessions. */
  admin: Db;
  /** Access token of the current request's session, kept alive while the others are revoked. */
  accessToken: string | null;
};

/**
 * A person changes their OWN password (every role). The identity comes from the server context, never from input.
 * Steps: check the current password, set the new one, sign out every other session of the same person.
 * Passwords are never logged and never returned.
 */
export async function changeOwnPassword(deps: PasswordDeps, ctx: RequestContext, input: ChangePasswordInput): Promise<Result<{ othersSignedOut: boolean }>> {
  const parsed = ChangePasswordSchema.safeParse(input);
  if (!parsed.success) {
    const tooShort = parsed.error.issues.some(issue => issue.path[0] === 'newPassword');
    return failure('VALIDATION', tooShort ? { newPassword: `הסיסמה החדשה צריכה להכיל לפחות ${MIN_PASSWORD} תווים` } : undefined);
  }
  const { currentPassword, newPassword } = parsed.data;
  if (currentPassword === newPassword) return failure('VALIDATION', { newPassword: 'הסיסמה החדשה זהה לנוכחית. יש לבחור סיסמה אחרת' });
  try {
    const check = await deps.authClient.auth.signInWithPassword({ email: ctx.actor.email, password: currentPassword });
    if (check.error || !check.data.session) {
      if (check.error?.status === 429) return failure('RATE_LIMITED');
      return failure('VALIDATION', { currentPassword: 'הסיסמה הנוכחית שגויה' });
    }
    // The check opened a session of its own on the service client; close it so it never lingers.
    await deps.authClient.auth.signOut({ scope: 'local' }).catch(() => undefined);
    const updated = await deps.admin.auth.admin.updateUserById(ctx.actor.userId, { password: newPassword });
    if (updated.error) return { ok: false, error: mapError(updated.error) };
    let othersSignedOut = false;
    if (deps.accessToken) {
      const others = await deps.admin.auth.admin.signOut(deps.accessToken, 'others').catch(() => ({ error: new Error('failed') }));
      othersSignedOut = !others.error;
    }
    return { ok: true, value: { othersSignedOut } };
  } catch { return failure('UNAVAILABLE'); }
}

/**
 * A person changes their OWN name. The update path (`prepare_profile_update`) is owner-only in the database, so for now only
 * an admin can use it; a non-owner is refused by the server here and by the database. By decision only an admin changes names.
 */
export async function changeOwnName(platform: Platform, ctx: RequestContext, input: ChangeNameInput): Promise<Result<{ id: string; revision: number }>> {
  const parsed = ChangeNameSchema.safeParse(input);
  if (!parsed.success) return failure('VALIDATION', { fullName: 'יש להזין שם באורך של עד 120 תווים' });
  if (!ctx.actor.isOwner) return failure('FORBIDDEN');
  try {
    const profile = await ctx.db.from('profiles').select('revision').eq('id', ctx.actor.userId).maybeSingle();
    if (profile.error || !profile.data) return failure('UNAVAILABLE');
    return await platform.authAdmin.setEmail(ctx, { userId: ctx.actor.userId, expectedRevision: profile.data.revision, fullName: parsed.data.fullName, email: ctx.actor.email });
  } catch (error) { return { ok: false, error: mapError(error) }; }
}

/** Builds the clients for the current request (server-only), then runs `changeOwnPassword`. */
export async function changeOwnPasswordForRequest(ctx: RequestContext, input: ChangePasswordInput): Promise<Result<{ othersSignedOut: boolean }>> {
  const session = await ctx.db.auth.getSession();
  const ip = trustedClientIp(await headers());
  return changeOwnPassword({ authClient: createAuthClient(ip), admin: createPrivilegedClient(), accessToken: session.data.session?.access_token ?? null }, ctx, input);
}
