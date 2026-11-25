import { describe, expect, it, vi } from 'vitest';
import type { Db, Platform, RequestContext } from '../../../src/types/contracts';
vi.mock('server-only', () => ({}));
import { permissions } from '../../../src/lib/permissions';
import { createProjectQueries } from '../../../src/features/projects/logic/queries';

const projectId = '95820c6e-e329-4c37-a6a3-cd4d391be79c';
const allowed = { view: true, editDetails: false, uploadDocument: false, manageAccess: false, writeTasks: true, deleteTasks: false, report: true, viewFinance: false, writeFinance: false, cancelTransaction: false };
vi.mock('../../../src/lib/db/rpc', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../src/lib/db/rpc')>();
  return { ...actual, rpc: vi.fn(async () => ({ ok: true, value: allowed })) };
});
const ctxOf = (isOwner: boolean, status: string): RequestContext => ({
  actor: { userId: 'u', fullName: 'x', email: 'x@example.invalid', isOwner },
  db: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { status }, error: null }) }) }) }) } as unknown as Db,
  today: '2026-11-25',
});

describe('finished projects are for owner-level accounts only (item 6)', () => {
  it.each(['manager-or-worker'])('closes every permission for a non-owner on a finished project (%s)', async () => {
    const r = await permissions.forProject(ctxOf(false, 'completed'), { projectId });
    expect(r).toMatchObject({ ok: true, value: { view: false, report: false, writeTasks: false, viewFinance: false } });
  });
  it('keeps access to an active project for a non-owner', async () => {
    expect(await permissions.forProject(ctxOf(false, 'active'), { projectId })).toEqual({ ok: true, value: allowed });
  });
  it('lets the owner through on a finished project without a second read', async () => {
    expect(await permissions.forProject(ctxOf(true, 'completed'), { projectId })).toEqual({ ok: true, value: allowed });
  });
  it('listProjects drops finished cards for a non-owner and keeps them for the owner', async () => {
    const card = (id: string, status: string) => ({ id, name: 'פרויקט', businessName: 'לקוח', siteAddress: 'כתובת', status, archived: false, coverFileId: null, openTaskCount: 0, reportCount: 0 });
    const cards = [card('a1b2c3d4-0000-4000-8000-000000000001', 'active'), card('a1b2c3d4-0000-4000-8000-000000000002', 'completed')];
    const platform = { rpc: vi.fn(async () => ({ ok: true, value: cards })), format: { searchKey: (s: string) => s } } as unknown as Platform;
    const queries = createProjectQueries(platform);
    const forNonOwner = await queries.listProjects(ctxOf(false, 'active'), {});
    const forOwner = await queries.listProjects(ctxOf(true, 'active'), {});
    expect(forNonOwner.ok && forNonOwner.value.map(c => c.status)).toEqual(['active']);
    expect(forOwner.ok && forOwner.value).toHaveLength(2);
  });
});
