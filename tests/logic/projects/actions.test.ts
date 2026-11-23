import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Platform, RequestContext } from '../../../src/types/contracts';
vi.mock('server-only', () => ({}));
const provider = vi.hoisted(() => ({ createPlatform: vi.fn() }));
vi.mock('../../../src/lib/auth/platform', () => provider);
import * as actions from '../../../src/features/projects/logic/actions';
const ctx = { actor: { userId: randomUUID(), fullName: 'בדוי', email: 'test@example.invalid', isOwner: true }, db: {}, today: '2026-11-22' } as RequestContext;
const fields = { name: 'בדוי', businessName: 'בדוי', siteAddress: 'בדוי', contact: { name: 'בדוי', phone: '0', email: null, roleTitle: null }, startDate: null, endDate: null, accessNotes: null };

describe('Projects Server Action boundary', () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it('derives the authenticated context in the server and passes validated input', async () => {
    const rpc = vi.fn().mockResolvedValue({ ok: true, value: { id: randomUUID(), revision: 1 } });
    const getContext = vi.fn().mockResolvedValue({ ok: true, value: ctx });
    provider.createPlatform.mockResolvedValue({ auth: { getContext }, rpc } as unknown as Platform);
    const requestId = randomUUID();
    expect(await actions.createProject({ requestId, fields })).toMatchObject({ ok: true });
    expect(getContext).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith(ctx, 'create_project', { requestId, fields });
  });
  it('returns authentication failure without reaching a project operation', async () => {
    const rpc = vi.fn();
    provider.createPlatform.mockResolvedValue({ auth: { getContext: vi.fn().mockResolvedValue({ ok: false, error: { code: 'UNAUTHENTICATED', message: 'יש להתחבר מחדש' } }) }, rpc });
    expect(await actions.createProject({ requestId: randomUUID(), fields })).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } });
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rejects identity/context injected through client input', async () => {
    const rpc = vi.fn();
    provider.createPlatform.mockResolvedValue({ auth: { getContext: vi.fn().mockResolvedValue({ ok: true, value: ctx }) }, rpc });
    expect(await actions.createProject({ requestId: randomUUID(), fields, ctx } as Parameters<typeof actions.createProject>[0])).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(rpc).not.toHaveBeenCalled();
  });
  it('maps platform initialization failures to a safe application error', async () => {
    provider.createPlatform.mockRejectedValue(new Error('fixture internal provider detail'));
    const result = await actions.listProjects({});
    expect(result).toMatchObject({ ok: false, error: { code: 'UNAVAILABLE' } });
    expect(JSON.stringify(result)).not.toContain('provider detail');
  });
});
