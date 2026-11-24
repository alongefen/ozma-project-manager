import { describe, expect, it, vi } from 'vitest';
import type { Db, Platform, RequestContext } from '../../../src/types/contracts';
vi.mock('server-only', () => ({}));
import { changeOwnName, changeOwnPassword } from '../../../src/features/account/logic/commands';

const id = '711795f0-48c2-4c8f-b470-dd0c95a2aaf7';
const other = '95820c6e-e329-4c37-a6a3-cd4d391be79c';
const ctxFor = (isOwner: boolean, revision = 7) => {
  const maybeSingle = vi.fn(async () => ({ data: { revision }, error: null }));
  const query: Record<string, unknown> = { select: vi.fn(() => query), eq: vi.fn(() => query), maybeSingle };
  const db = { from: vi.fn(() => query) } as unknown as Db;
  return { ctx: { actor: { userId: id, fullName: 'שם בדוי', email: 'me@example.invalid', isOwner }, db, today: '2026-11-24' } as RequestContext, query };
};
function deps(over: { signIn?: unknown; update?: unknown; token?: string | null } = {}) {
  const signInWithPassword = vi.fn(async () => over.signIn ?? { data: { session: { access_token: 'x' } }, error: null });
  const authSignOut = vi.fn(async () => ({ error: null }));
  const updateUserById = vi.fn(async () => over.update ?? { error: null });
  const adminSignOut = vi.fn(async () => ({ error: null }));
  return {
    signInWithPassword, authSignOut, updateUserById, adminSignOut,
    deps: {
      authClient: { auth: { signInWithPassword, signOut: authSignOut } } as unknown as Db,
      admin: { auth: { admin: { updateUserById, signOut: adminSignOut } } } as unknown as Db,
      accessToken: over.token === undefined ? 'current-token' : over.token,
    },
  };
}
const input = { currentPassword: 'old-password-1', newPassword: 'new-password-2' };

describe('changeOwnPassword', () => {
  it('checks the current password, sets the new one for the signed-in person only, signs out other sessions', async () => {
    const { ctx } = ctxFor(false); const d = deps();
    const result = await changeOwnPassword(d.deps, ctx, input);
    expect(result).toEqual({ ok: true, value: { othersSignedOut: true } });
    expect(d.signInWithPassword).toHaveBeenCalledWith({ email: 'me@example.invalid', password: 'old-password-1' });
    expect(d.updateUserById).toHaveBeenCalledWith(id, { password: 'new-password-2' });
    expect(d.adminSignOut).toHaveBeenCalledWith('current-token', 'others');
    expect(JSON.stringify(result)).not.toContain('password');
  });
  it('a wrong current password changes nothing', async () => {
    const { ctx } = ctxFor(false); const d = deps({ signIn: { data: { session: null }, error: { status: 400 } } });
    const result = await changeOwnPassword(d.deps, ctx, input);
    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION', fieldErrors: { currentPassword: 'הסיסמה הנוכחית שגויה' } } });
    expect(d.updateUserById).not.toHaveBeenCalled();
    expect(d.adminSignOut).not.toHaveBeenCalled();
  });
  it('rate limit is reported, not treated as a wrong password', async () => {
    const { ctx } = ctxFor(false); const d = deps({ signIn: { data: { session: null }, error: { status: 429 } } });
    expect(await changeOwnPassword(d.deps, ctx, input)).toMatchObject({ ok: false, error: { code: 'RATE_LIMITED' } });
  });
  it('applies the creation rule (8+ chars) and refuses an unchanged password before any call', async () => {
    const { ctx } = ctxFor(false); const d = deps();
    expect(await changeOwnPassword(d.deps, ctx, { ...input, newPassword: 'short' })).toMatchObject({ ok: false, error: { code: 'VALIDATION', fieldErrors: { newPassword: expect.stringContaining('8') } } });
    expect(await changeOwnPassword(d.deps, ctx, { currentPassword: 'same-password', newPassword: 'same-password' })).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(await changeOwnPassword(d.deps, ctx, { ...input, userId: other } as never)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(d.signInWithPassword).not.toHaveBeenCalled();
  });
  it('still succeeds when other sessions cannot be revoked, and says so', async () => {
    const { ctx } = ctxFor(false); const d = deps({ token: null });
    expect(await changeOwnPassword(d.deps, ctx, input)).toEqual({ ok: true, value: { othersSignedOut: false } });
  });
  it('maps an auth provider failure to a plain code', async () => {
    const { ctx } = ctxFor(false); const d = deps({ update: { error: { message: 'raw provider detail', status: 500 } } });
    const result = await changeOwnPassword(d.deps, ctx, input);
    expect(result).toMatchObject({ ok: false, error: { code: 'UNAVAILABLE' } });
    expect(JSON.stringify(result)).not.toContain('raw provider detail');
  });
});

describe('changeOwnName', () => {
  const platformWith = (setEmail: unknown) => ({ authAdmin: { setEmail } }) as unknown as Platform;
  it('an owner changes their own name with the current revision and the same email', async () => {
    const { ctx } = ctxFor(true, 9); const setEmail = vi.fn(async () => ({ ok: true, value: { id, revision: 10 } }));
    expect(await changeOwnName(platformWith(setEmail), ctx, { fullName: '  שם חדש ' })).toEqual({ ok: true, value: { id, revision: 10 } });
    expect(setEmail).toHaveBeenCalledWith(ctx, { userId: id, expectedRevision: 9, fullName: 'שם חדש', email: 'me@example.invalid' });
  });
  it('a non-owner is refused here (the database path is owner-only)', async () => {
    const { ctx } = ctxFor(false); const setEmail = vi.fn();
    expect(await changeOwnName(platformWith(setEmail), ctx, { fullName: 'שם' })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(setEmail).not.toHaveBeenCalled();
  });
  it('rejects an empty or too long name', async () => {
    const { ctx } = ctxFor(true); const setEmail = vi.fn();
    expect(await changeOwnName(platformWith(setEmail), ctx, { fullName: '   ' })).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(await changeOwnName(platformWith(setEmail), ctx, { fullName: 'א'.repeat(121) })).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(setEmail).not.toHaveBeenCalled();
  });
});
