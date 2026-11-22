import { describe, expect, it, vi } from 'vitest';
import type { Platform, RequestContext, Result } from '../../../src/types/contracts';
vi.mock('server-only', () => ({}));
import { createFilesApi } from '../../../src/features/files/logic';
import { createFilesActions } from '../../../src/features/files/logic/action-service';
const projectId = '2db95268-54da-42fa-bf62-2648ac3cc579';
const id = '6d54739e-32cf-44fb-9c7f-f26aef663d88';
const ctx = { actor: { userId: id, fullName: 'מנהל בדוי', email: 'fixture@example.invalid', isOwner: false }, db: {}, today: '2026-11-22' } as RequestContext;
function fixture() {
  const rpc = vi.fn().mockResolvedValue({ ok: true, value: { id, revision: 1 } });
  const getContext = vi.fn().mockResolvedValue({ ok: true, value: ctx });
  const platform = { rpc, auth: { getContext } } as unknown as Platform;
  return { rpc, getContext, platform, api: createFilesApi(platform), actions: createFilesActions(platform) };
}
describe('מסמכים: תזמור כתיבות וגבול פעולות השרת', () => {
  it.each(['owner', 'all', 'selected'] as const)('forwards explicit %s access without granting uploader access', async mode => {
    const f = fixture();
    const access = mode === 'selected' ? { mode, userIds: [projectId] } : { mode };
    const input = { projectId, fileId: id, category: 'plans' as const, access };
    expect(await f.api.createDocument(ctx, input)).toEqual({ ok: true, value: { id, revision: 1 } });
    expect(f.rpc).toHaveBeenCalledWith(ctx, 'create_document', input);
  });
  it('forwards replacement, revision and archive to their atomic RPCs', async () => {
    const f = fixture();
    const replacement = { projectId, fileId: id, category: 'renderings' as const, access: { mode: 'owner' as const }, replacesDocumentId: projectId };
    await f.api.createDocument(ctx, replacement);
    await f.api.setDocumentAccess(ctx, { id, expectedRevision: 3, access: { mode: 'all' } });
    await f.api.setDocumentArchived(ctx, { id, expectedRevision: 4, archived: true });
    expect(f.rpc.mock.calls).toEqual([[ctx, 'create_document', replacement], [ctx, 'set_document_access', { id, expectedRevision: 3, access: { mode: 'all' } }], [ctx, 'set_document_archived', { id, expectedRevision: 4, archived: true }]]);
  });
  it.each(['FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'PROJECT_READ_ONLY', 'VALIDATION'])('preserves server rejection %s', async code => {
    const f = fixture(); const error = { ok: false, error: { code, message: 'נדחה' } };
    f.rpc.mockResolvedValue(error);
    expect(await f.api.setDocumentArchived(ctx, { id, expectedRevision: 1, archived: false })).toEqual(error);
  });
  it('gets candidates only through its dedicated RPC', async () => {
    const f = fixture(); f.rpc.mockResolvedValue({ ok: true, value: [{ userId: id, fullName: 'בדוי' }] });
    expect(await f.api.listAccessCandidates(ctx, { projectId })).toEqual({ ok: true, value: [{ userId: id, fullName: 'בדוי' }] });
    expect(f.rpc).toHaveBeenCalledWith(ctx, 'project_access_candidates', { projectId });
  });
  it('takes action context from auth, never from the submitted object', async () => {
    const f = fixture(); const input = { projectId, fileId: id, category: 'specification', access: { mode: 'all' } };
    expect((await f.actions.createDocument(input as never)).ok).toBe(true);
    expect(f.getContext).toHaveBeenCalledOnce();
    expect(f.rpc.mock.calls[0][0]).toBe(ctx);
    expect(await f.actions.createDocument({ ...input, actor: { isOwner: true } } as never)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(f.rpc).toHaveBeenCalledOnce();
  });
  it.each([{ projectId, fileId: id, category: 'plans' }, { projectId, fileId: id, category: 'plans', access: { mode: 'selected', userIds: [] } }, { projectId: 'invalid', fileId: id, category: 'plans', access: { mode: 'all' } }, { projectId, fileId: id, category: 'unknown', access: { mode: 'all' } }])('rejects invalid creation before RPC', async input => {
    const f = fixture(); expect(await f.actions.createDocument(input as never)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } }); expect(f.rpc).not.toHaveBeenCalled();
  });
  it('blocks unauthenticated actions before touching document data', async () => {
    const f = fixture(); const denied: Result<RequestContext> = { ok: false, error: { code: 'UNAUTHENTICATED', message: 'יש להתחבר' } };
    f.getContext.mockResolvedValue(denied);
    expect(await f.actions.setDocumentArchived({ id, expectedRevision: 1, archived: true })).toEqual(denied); expect(f.rpc).not.toHaveBeenCalled();
  });
});
