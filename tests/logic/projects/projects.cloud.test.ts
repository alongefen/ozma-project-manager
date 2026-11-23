import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import type { Platform, ProjectFields, ProjectsApi, RequestContext, Result, Saved, StorageService } from '../../../src/types/contracts';
vi.mock('server-only', () => ({}));
import { createProjectsApi } from '../../../src/features/projects/logic';
import { rpc, fetchAll } from '../../../src/lib/db/rpc';
import { permissions } from '../../../src/lib/permissions';
import { format } from '../../../src/lib/format';
import { createStorageService } from '../../../src/lib/storage/service';
import { cloudActor, cloudClients, cloudEnvironment, cloudOwner } from '../../auth/support/cloud';

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`Projects fixture failed: ${result.error.code}`);
  return result.value;
}
const runId = randomUUID();
const base: ProjectFields = { name: `P142 ${runId}`, businessName: 'עסק בדוי בע״מ', siteAddress: 'רחוב בדיקה 1', contact: { name: 'איש קשר בדוי', phone: '0000000000', email: null, roleTitle: null }, startDate: null, endDate: null, accessNotes: 'הערת גישה בדויה' };
let ben: RequestContext, mixed: RequestContext, api: ProjectsApi, storage: StorageService;
let projectA: Saved, projectB: Saved, hidden: Saved;
const makeProject = (suffix: string, businessNumber?: string) => api.createProject(ben, { requestId: randomUUID(), fields: { ...base, name: `${base.name} ${suffix}`, ...(businessNumber ? { businessNumber } : {}) } }).then(unwrap);
async function assign(projectId: string, role: 'manager' | 'worker') {
  unwrap(await rpc(ben, 'set_membership', { userId: mixed.actor.userId, projectId, role, expectedRevision: null }));
}
beforeAll(async () => {
  ben = await cloudOwner();
  mixed = (await cloudActor(ben, 'p142-mixed')).ctx;
  api = createProjectsApi({ rpc, fetchAll, permissions, format } as Platform);
  const env = cloudEnvironment();
  storage = createStorageService({ privileged: () => cloudClients().admin, url: env.url, publishableKey: env.key });
  projectA = await makeProject('A', 'FAKE-142');
  projectB = await makeProject('B');
  hidden = await makeProject('hidden');
  await assign(projectA.id, 'manager');
  await assign(projectB.id, 'worker');
}, 120000);

async function uploadCover(projectId: string) {
  const bytes = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#334455' } }).png().toBuffer();
  const targets = unwrap(await storage.beginUpload(ben, { purpose: 'cover', projectId, files: [{ clientId: randomUUID(), name: 'שער בדוי.png', mime: 'image/png', sizeBytes: bytes.length }] }));
  const target = unwrap(targets[0].target);
  const sent = await cloudClients().publicClient().storage.from(target.bucket).uploadToSignedUrl(target.path, target.token, bytes, { contentType: 'image/png' });
  expect(sent.error?.name).toBeUndefined();
  unwrap(await storage.finishUpload(ben, { fileId: target.fileId }));
  return target.fileId;
}

describe.sequential('ProjectsApi through the existing development cloud', () => {
  it('lists only authorized projects and hides unknown direct IDs and search results', async () => {
    const cards = unwrap(await api.listProjects(mixed, { search: runId }));
    expect(cards.map(card => card.id).sort()).toEqual([projectA.id, projectB.id].sort());
    expect(await api.getProject(mixed, { id: hidden.id })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(unwrap(await api.listProjects(mixed, { search: `${runId} hidden` }))).toEqual([]);
    const owner = unwrap(await api.listProjects(ben, { search: runId }));
    expect(owner.map(card => card.id)).toContain(hidden.id);
  });

  it('returns common contact data and manager names while omitting owner-only business number', async () => {
    const manager = unwrap(await api.getProject(mixed, { id: projectA.id }));
    expect(manager.contact).toEqual(base.contact);
    expect(manager.managerNames).toContain(mixed.actor.fullName);
    expect(manager.permissions.editDetails).toBe(true);
    expect(Object.hasOwn(manager, 'businessNumber')).toBe(false);
    const worker = unwrap(await api.getProject(mixed, { id: projectB.id }));
    expect(worker.permissions.editDetails).toBe(false);
    expect(unwrap(await api.getProject(ben, { id: projectA.id })).businessNumber).toBe('FAKE-142');
  });

  it('permits manager edits only in its project and rejects hidden-number changes', async () => {
    const edited = unwrap(await api.updateProject(mixed, { id: projectA.id, expectedRevision: projectA.revision, fields: { ...base, name: `${base.name} A edited` } }));
    projectA = edited;
    expect(unwrap(await api.getProject(ben, { id: projectA.id })).name).toBe(`${base.name} A edited`);
    expect(await api.updateProject(mixed, { id: projectB.id, expectedRevision: projectB.revision, fields: base })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(await api.updateProject(mixed, { id: hidden.id, expectedRevision: hidden.revision, fields: base })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(await api.updateProject(mixed, { id: projectA.id, expectedRevision: projectA.revision, fields: { ...base, businessNumber: 'forbidden' } })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(unwrap(await api.getProject(ben, { id: projectA.id })).businessNumber).toBe('FAKE-142');
  });

  it('rejects stale revisions and retains the accepted project state', async () => {
    const p = await makeProject('revision');
    const accepted = unwrap(await api.updateProject(ben, { id: p.id, expectedRevision: p.revision, fields: { ...base, name: `${base.name} accepted` } }));
    expect(await api.updateProject(ben, { id: p.id, expectedRevision: p.revision, fields: { ...base, name: `${base.name} rejected` } })).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
    expect(unwrap(await api.getProject(ben, { id: p.id }))).toMatchObject({ name: `${base.name} accepted`, revision: accepted.revision });
  });

  it('creates one project for repeated create request identity, without a manager', async () => {
    const input = { requestId: randomUUID(), fields: { ...base, name: `${base.name} retry` } };
    const first = unwrap(await api.createProject(ben, input));
    expect(await api.createProject(ben, input)).toEqual({ ok: true, value: first });
    expect(unwrap(await api.listProjects(ben, { search: input.fields.name })).map(card => card.id)).toEqual([first.id]);
    expect(unwrap(await api.getProject(ben, { id: first.id })).managerNames).toEqual([]);
  });

  it('keeps create, status, archive and cover restricted to owner even with a forged context flag', async () => {
    const forged = { ...mixed, actor: { ...mixed.actor, isOwner: true } };
    const results = [
      await api.createProject(forged, { requestId: randomUUID(), fields: base }),
      await api.setProjectStatus(forged, { id: projectA.id, expectedRevision: projectA.revision, status: 'completed' }),
      await api.setProjectArchived(forged, { id: projectA.id, expectedRevision: projectA.revision, archived: true }),
      await api.setProjectCover(forged, { id: projectA.id, expectedRevision: projectA.revision, fileId: randomUUID() }),
    ];
    for (const result of results) expect(result).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(await storage.beginUpload(mixed, { purpose: 'cover', projectId: projectA.id, files: [{ clientId: randomUUID(), name: 'אסור.png', mime: 'image/png', sizeBytes: 12 }] })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
  });

  it('completion and archive keep reads while blocking manager writes, and reopening restores them', async () => {
    let p = await makeProject('lifecycle');
    await assign(p.id, 'manager');
    p = unwrap(await api.setProjectStatus(ben, { id: p.id, expectedRevision: p.revision, status: 'completed' }));
    expect(unwrap(await api.getProject(mixed, { id: p.id })).permissions.editDetails).toBe(false);
    expect(await api.updateProject(mixed, { id: p.id, expectedRevision: p.revision, fields: base })).toMatchObject({ ok: false, error: { code: 'PROJECT_READ_ONLY' } });
    expect(unwrap(await api.listProjects(mixed, { search: `${runId} lifecycle`, status: 'active' }))).toEqual([]);
    expect(unwrap(await api.listProjects(mixed, { search: `${runId} lifecycle`, status: 'completed' })).map(card => card.id)).toEqual([p.id]);
    p = unwrap(await api.setProjectStatus(ben, { id: p.id, expectedRevision: p.revision, status: 'active' }));
    p = unwrap(await api.setProjectArchived(ben, { id: p.id, expectedRevision: p.revision, archived: true }));
    expect(await api.updateProject(mixed, { id: p.id, expectedRevision: p.revision, fields: base })).toMatchObject({ ok: false, error: { code: 'PROJECT_READ_ONLY' } });
    expect(unwrap(await api.listProjects(mixed, { search: `${runId} lifecycle` }))).toEqual([]);
    expect(unwrap(await api.listProjects(mixed, { search: `${runId} lifecycle`, archived: true })).map(card => card.id)).toEqual([p.id]);
    p = unwrap(await api.setProjectArchived(ben, { id: p.id, expectedRevision: p.revision, archived: false }));
    expect(await api.updateProject(mixed, { id: p.id, expectedRevision: p.revision, fields: base })).toMatchObject({ ok: true });
  });

  it('applies normalized search and combines it with status filters', async () => {
    const cards = unwrap(await api.listProjects(mixed, { search: '  עסק   בדוי בע"מ ', status: 'active' }));
    expect(cards.map(card => card.id)).toContain(projectA.id);
    expect(cards.map(card => card.id)).toContain(projectB.id);
    expect(cards.map(card => card.id)).not.toContain(hidden.id);
  });

  it('uses database counts without counting completed or deleted tasks and cancelled reports', async () => {
    const p = await makeProject('counts');
    const t1 = unwrap(await rpc<unknown, Saved>(ben, 'create_task', { requestId: randomUUID(), projectId: p.id, body: 'פתוח', completed: false, dueDate: null }));
    unwrap(await rpc(ben, 'create_task', { requestId: randomUUID(), projectId: p.id, body: 'סגור', completed: true, dueDate: null }));
    const deleted = unwrap(await rpc<unknown, Saved>(ben, 'create_task', { requestId: randomUUID(), projectId: p.id, body: 'מחוק', completed: false, dueDate: null }));
    unwrap(await rpc(ben, 'delete_task', { id: deleted.id, expectedRevision: deleted.revision }));
    expect(t1.id).toBeTruthy();
    unwrap(await rpc(ben, 'create_entry', { requestId: randomUUID(), projectId: p.id, workDate: '2026-11-01', body: 'דיווח בדוי', fileIds: [] }));
    const cancelled = unwrap(await rpc<unknown, Saved>(ben, 'create_entry', { requestId: randomUUID(), projectId: p.id, workDate: '2026-11-01', body: 'מבוטל', fileIds: [] }));
    unwrap(await rpc(ben, 'cancel_entry', { id: cancelled.id, expectedRevision: cancelled.revision }));
    expect(unwrap(await api.listProjects(ben, { search: `${runId} counts` }))).toMatchObject([{ id: p.id, openTaskCount: 1, reportCount: 1 }]);
  });

  it('attaches and replaces an existing-storage cover, rejects a foreign project cover, and limits access', async () => {
    const p = await makeProject('cover');
    await assign(p.id, 'worker');
    const foreign = await uploadCover(projectB.id);
    expect(await api.setProjectCover(ben, { id: p.id, expectedRevision: p.revision, fileId: foreign })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    const first = await uploadCover(p.id);
    const attached = unwrap(await api.setProjectCover(ben, { id: p.id, expectedRevision: p.revision, fileId: first }));
    expect(unwrap(await api.getProject(mixed, { id: p.id })).coverFileId).toBe(first);
    expect(await storage.getSignedUrl(mixed, { fileId: first, variant: 'original', download: false })).toMatchObject({ ok: true });
    const replacement = await uploadCover(p.id);
    unwrap(await api.setProjectCover(ben, { id: p.id, expectedRevision: attached.revision, fileId: replacement }));
    expect(unwrap(await api.getProject(mixed, { id: p.id })).coverFileId).toBe(replacement);
    expect(await storage.getSignedUrl(mixed, { fileId: first, variant: 'original', download: false })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    const hiddenCover = await uploadCover(hidden.id);
    unwrap(await api.setProjectCover(ben, { id: hidden.id, expectedRevision: hidden.revision, fileId: hiddenCover }));
    expect(await storage.getSignedUrl(mixed, { fileId: hiddenCover, variant: 'original', download: false })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  }, 120000);
});
