import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { Platform, ProjectFields, RequestContext } from '../../../src/types/contracts';
vi.mock('server-only', () => ({}));
import { createProjectsApi } from '../../../src/features/projects/logic';
import { format } from '../../../src/lib/format';

const id = randomUUID();
const fields: ProjectFields = { name: ' פרויקט בדוי ', businessName: 'עסק בדוי', siteAddress: 'רחוב בדיקה', contact: { name: 'בדוי', phone: '0', email: null, roleTitle: null }, startDate: null, endDate: null, accessNotes: null };
function fixture() {
  const rpc = vi.fn().mockResolvedValue({ ok: true, value: { id, revision: 2 } });
  const ctx = { actor: { userId: randomUUID(), fullName: 'בדוי', email: 'test@example.invalid', isOwner: false }, today: '2026-11-22', db: {} } as RequestContext;
  const platform = { rpc, format } as unknown as Platform;
  return { api: createProjectsApi(platform), rpc, ctx };
}

describe('ProjectsApi server orchestration', () => {
  it('validates before writing and keeps request identity and revision in the RPC', async () => {
    const { api, rpc, ctx } = fixture();
    const requestId = randomUUID();
    expect(await api.createProject(ctx, { requestId, fields })).toMatchObject({ ok: true, value: { id } });
    expect(rpc).toHaveBeenCalledWith(ctx, 'create_project', { requestId, fields: { ...fields, name: fields.name.trim() } });
    await api.updateProject(ctx, { id, expectedRevision: 1, fields });
    expect(rpc).toHaveBeenLastCalledWith(ctx, 'update_project', { id, expectedRevision: 1, fields: { ...fields, name: fields.name.trim() } });
  });

  it.each([
    { ...fields, name: '  ' },
    { ...fields, contact: { ...fields.contact, phone: ' ' } },
    { ...fields, startDate: '2026-12-02', endDate: '2026-12-01' },
  ])('rejects invalid project fields without database mutation', async invalid => {
    const { api, rpc, ctx } = fixture();
    expect(await api.createProject(ctx, { requestId: randomUUID(), fields: invalid })).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects caller-supplied identity and unknown input keys', async () => {
    const { api, rpc, ctx } = fixture();
    const input = { requestId: randomUUID(), fields, actorId: randomUUID() };
    expect(await api.createProject(ctx, input)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('routes owner mutations to database functions and preserves failures', async () => {
    const { api, rpc, ctx } = fixture();
    await api.setProjectStatus(ctx, { id, expectedRevision: 2, status: 'completed' });
    expect(rpc).toHaveBeenLastCalledWith(ctx, 'set_project_status', { id, expectedRevision: 2, status: 'completed' });
    await api.setProjectArchived(ctx, { id, expectedRevision: 3, archived: true });
    expect(rpc).toHaveBeenLastCalledWith(ctx, 'set_project_archived', { id, expectedRevision: 3, archived: true });
    const fileId = randomUUID();
    await api.setProjectCover(ctx, { id, expectedRevision: 4, fileId });
    expect(rpc).toHaveBeenLastCalledWith(ctx, 'set_project_cover', { id, expectedRevision: 4, fileId });
    rpc.mockResolvedValue({ ok: false, error: { code: 'CONFLICT', message: 'הנתונים השתנו' } });
    expect(await api.updateProject(ctx, { id, expectedRevision: 1, fields })).toEqual({ ok: false, error: { code: 'CONFLICT', message: 'הנתונים השתנו' } });
  });

  it('combines status/archive filtering with normalized search over permitted cards', async () => {
    const { api, rpc, ctx } = fixture();
    const card = { id, name: 'אתר', businessName: 'TEST בע״מ', siteAddress: 'בדוי', status: 'active', archived: false, coverFileId: null, reportCount: 2, openTaskCount: 3 };
    rpc.mockResolvedValue({ ok: true, value: [card, { ...card, id: randomUUID(), businessName: 'אחר' }] });
    expect(await api.listProjects(ctx, { search: '  test   בע"מ ', status: 'active', archived: false })).toEqual({ ok: true, value: [card] });
    expect(rpc).toHaveBeenCalledWith(ctx, 'project_cards', { status: 'active', archived: false });
  });

  it('does not truncate a JSON aggregate list at the Data API page size', async () => {
    const { api, rpc, ctx } = fixture();
    const cards = Array.from({ length: 1001 }, (_, n) => ({ id: randomUUID(), name: `פרויקט ${n}`, businessName: 'בדוי', siteAddress: 'בדוי', status: 'active', archived: false, coverFileId: null, reportCount: 0, openTaskCount: 0 }));
    rpc.mockResolvedValue({ ok: true, value: cards });
    const result = await api.listProjects(ctx, {});
    expect(result.ok && result.value.length).toBe(1001);
  });
});
