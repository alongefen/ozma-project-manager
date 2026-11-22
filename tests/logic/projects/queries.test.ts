import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { Db, Platform, RequestContext } from '../../../src/types/contracts';
vi.mock('server-only', () => ({}));
import { createProjectsApi } from '../../../src/features/projects/logic';
import { format } from '../../../src/lib/format';
const id = randomUUID();
const permissionFlags = { view: true, editDetails: false, uploadDocument: false, manageAccess: false, writeTasks: true, deleteTasks: false, report: true, viewFinance: false, writeFinance: false, cancelTransaction: false };
const project = { id, name: 'בדוי', business_name: 'עסק', site_address: 'רחוב', start_date: null, end_date: null, access_notes: null, status: 'active', archived_at: null, revision: 1 };
function fixture(owner = false) {
  const rows: Record<string, { data: unknown; error: unknown }> = {
    projects: { data: project, error: null },
    project_contacts: { data: { name: 'איש בדיקה', phone: '0', email: null, role_title: null }, error: null },
    project_covers: { data: null, error: null },
    project_private: { data: { business_number: 'FAKE' }, error: null },
  };
  const from = vi.fn((table: string) => {
    const builder = { select: vi.fn(() => builder), eq: vi.fn(() => builder), maybeSingle: vi.fn(async () => rows[table]) };
    return builder;
  });
  const rpc = vi.fn().mockResolvedValue({ ok: true, value: ['מנהל בדוי'] });
  const forProject = vi.fn().mockResolvedValue({ ok: true, value: permissionFlags });
  const platform = { rpc, format, permissions: { forProject } } as unknown as Platform;
  const ctx: RequestContext = { db: { from } as unknown as Db, actor: { userId: randomUUID(), fullName: 'בדוי', email: 'test@example.invalid', isOwner: owner }, today: '2026-11-22' };
  return { api: createProjectsApi(platform), rows, from, rpc, forProject, ctx };
}
describe('Project details RLS reads and projection', () => {
  it('maps common fields, defaults missing cover and omits private reads for non-owners', async () => {
    const { api, from, rpc, forProject, ctx } = fixture();
    expect(await api.getProject(ctx, { id })).toEqual({ ok: true, value: {
      id, name: 'בדוי', businessName: 'עסק', siteAddress: 'רחוב', startDate: null, endDate: null, accessNotes: null, status: 'active', archived: false, revision: 1,
      contact: { name: 'איש בדיקה', phone: '0', email: null, roleTitle: null }, coverFileId: null, managerNames: ['מנהל בדוי'], permissions: permissionFlags,
    } });
    expect(from.mock.calls.map(([table]) => table)).not.toContain('project_private');
    expect(rpc).toHaveBeenCalledWith(ctx, 'project_manager_names', { projectId: id });
    expect(forProject).toHaveBeenCalledWith(ctx, { projectId: id });
  });
  it('reads a business number with the same user RLS client for owners', async () => {
    const { api, from, ctx } = fixture(true);
    expect(await api.getProject(ctx, { id })).toMatchObject({ ok: true, value: { businessNumber: 'FAKE' } });
    expect(from.mock.calls.map(([table]) => table)).toContain('project_private');
  });
  it('stops before related queries when the project is invisible', async () => {
    const { api, from, rows, rpc, ctx } = fixture();
    rows.projects.data = null;
    expect(await api.getProject(ctx, { id })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(from).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('does not report a partial success after a related query or permission failure', async () => {
    const { api, rows, ctx } = fixture();
    rows.project_contacts.error = { message: 'fixture secret database diagnostic' };
    const result = await api.getProject(ctx, { id });
    expect(result).toMatchObject({ ok: false, error: { code: 'UNAVAILABLE' } });
    expect(JSON.stringify(result)).not.toContain('diagnostic');
    rows.project_contacts.error = null;
    rows.project_contacts.data = null;
    expect(await api.getProject(ctx, { id })).toMatchObject({ ok: false });
  });
  it('rejects malformed database output and preserves typed RPC failures', async () => {
    const { api, rows, rpc, ctx } = fixture();
    rows.projects.data = { ...project, status: 'unexpected' };
    expect(await api.getProject(ctx, { id })).toMatchObject({ ok: false, error: { code: 'UNAVAILABLE' } });
    rpc.mockResolvedValue({ ok: true, value: [{ id: 'invalid' }] });
    expect(await api.listProjects(ctx, {})).toMatchObject({ ok: false, error: { code: 'UNAVAILABLE' } });
    rpc.mockResolvedValue({ ok: false, error: { code: 'UNAUTHENTICATED', message: 'יש להתחבר מחדש' } });
    expect(await api.listProjects(ctx, {})).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } });
  });
});
