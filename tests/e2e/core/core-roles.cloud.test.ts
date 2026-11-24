import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Json } from '../../../src/types/database';
import { actor, clients, membership, owner, project, readyFile, rpc, value, type Client, type TestActor } from '../../db/support/cloud';

// P2.8 core integration: one journey per role, straight against the Data API with real JWTs (this is
// the server; hidden buttons are not evidence). Fake data only. Cleanup touches only rows this file made:
// its three projects are archived (nothing is deleted) and its four accounts are deactivated.
type Saved = { id: string; revision: number };
type Row = Record<string, unknown>;
let admin: Client, ben: TestActor, mgr: TestActor, wrk: TestActor, mix: TestActor, fin: TestActor;
let A: Saved, B: Saved, C: Saved;
let finMembership: { revision: number }, mixOnA: { revision: number };
const mine: TestActor[] = [];
const ID = () => randomUUID();
const entry = (projectId: string, fileIds: string[] = []) => ({ requestId: ID(), projectId, workDate: '2026-01-01', body: 'דיווח בדוי', fileIds });
const task = (projectId: string) => ({ requestId: ID(), projectId, body: 'פתק בדוי', dueDate: null, completed: false });
const fields = { year: 2026, month: 1, day: null, kind: 'income', amount: 10050, details: 'תנועה בדויה' };
const ok = async (client: Client, name: Parameters<typeof rpc>[1], input: Json) => {
  const r = await rpc(client, name, input);
  expect(r.error, `${name} should pass: ${r.error?.message}`).toBeNull();
  return r.data as never;
};
async function deny(client: Client, name: Parameters<typeof rpc>[1], input: Json, code: string | RegExp) {
  const r = await rpc(client, name, input);
  expect(r.error, `${name} should be refused`).not.toBeNull();
  if (typeof code === 'string') expect(r.error?.message).toBe(code);
  else expect(r.error?.message).toMatch(code);
}
async function rows(client: Client, table: 'projects' | 'diary_entries' | 'documents' | 'transactions', id: string): Promise<Row[]> {
  const r = await client.from(table).select('*').eq('id', id);
  expect(r.error).toBeNull();
  return (r.data ?? []) as Row[];
}
const visibleProjects = async (client: Client) => {
  const r = await client.from('projects').select('id').in('id', [A.id, B.id, C.id]);
  expect(r.error).toBeNull();
  return (r.data ?? []).map(p => p.id).sort();
};
const doc = async (uploader: TestActor, projectId: string, access: Json) => {
  const fileId = await readyFile(admin, uploader, projectId, 'document');
  return { fileId, saved: await value<Saved>(uploader.client, 'create_document', { projectId, fileId, category: 'plans', access }) };
};

beforeAll(async () => {
  ({ admin } = clients());
  ben = await owner(admin);
  [mgr, wrk, mix, fin] = await Promise.all(['cmgr', 'cwrk', 'cmix', 'cfin'].map(l => actor(admin, ben.client, l)));
  mine.push(mgr, wrk, mix, fin);
  [A, B, C] = [await project(ben.client, 'ליבה-א'), await project(ben.client, 'ליבה-ב'), await project(ben.client, 'ליבה-ג')];
  // mgr: manager on A. wrk: worker on A. mix: manager on A and worker on B. fin: manager on A with finance opened by Ben.
  await membership(ben.client, mgr.id, A.id, 'manager');
  await membership(ben.client, wrk.id, A.id, 'worker');
  mixOnA = await membership(ben.client, mix.id, A.id, 'manager');
  await membership(ben.client, mix.id, B.id, 'worker');
  finMembership = await membership(ben.client, fin.id, A.id, 'manager');
  await value(ben.client, 'set_finance_access', { userId: fin.id, projectId: A.id, enabled: true, expectedRevision: finMembership.revision });
}, 180_000);

afterAll(async () => {
  if (!ben || !A) return;
  for (const p of [A, B, C].filter(Boolean)) {
    const row = await ben.client.from('projects').select('revision').eq('id', p.id).single();
    if (row.data) await rpc(ben.client, 'set_project_archived', { id: p.id, expectedRevision: row.data.revision, archived: true });
  }
  for (const person of mine) {
    const row = await ben.client.from('profiles').select('revision').eq('id', person.id).single();
    if (row.data) await rpc(ben.client, 'set_user_active', { id: person.id, active: false, expectedRevision: row.data.revision });
  }
}, 120_000);

describe.sequential('P2.8 core roles against the server', () => {
  it('Ben (owner): sees every project, finance of all projects, edits every report, manages access', async () => {
    expect(await visibleProjects(ben.client)).toEqual([A.id, B.id, C.id].sort());
    await ok(ben.client, 'create_transaction', { requestId: ID(), projectId: A.id, fields });
    expect(JSON.stringify(await ok(ben.client, 'finance_all_month_totals', {}))).toContain(A.id);
    const own = await value<Saved>(wrk.client, 'create_entry', entry(A.id));
    await ok(ben.client, 'correct_entry', { id: own.id, expectedRevision: 1, body: 'תיקון בעלים', fileIds: [] });
    await ok(ben.client, 'project_permissions', { projectId: A.id });
    const sensitive = await ben.client.from('sensitive_events').select('id').limit(1);
    expect(sensitive.error).toBeNull();
  });

  it('project manager (manager on A): works on A, no finance, no access changes, no other project, cannot edit others\' reports', async () => {
    expect(await visibleProjects(mgr.client)).toEqual([A.id]);
    await ok(mgr.client, 'create_task', task(A.id));
    const mine1 = await value<Saved>(mgr.client, 'create_entry', entry(A.id));
    await ok(mgr.client, 'correct_entry', { id: mine1.id, expectedRevision: 1, body: 'תיקון עצמי', fileIds: [] });
    const others = await value<Saved>(wrk.client, 'create_entry', entry(A.id));
    expect(await rows(mgr.client, 'diary_entries', others.id)).toHaveLength(1); // may read, not edit
    await deny(mgr.client, 'correct_entry', { id: others.id, expectedRevision: 1, body: 'x', fileIds: [] }, 'FORBIDDEN');
    await deny(mgr.client, 'move_entry', { id: others.id, expectedRevision: 1, projectId: A.id, workDate: '2026-01-02' }, 'FORBIDDEN');
    await deny(mgr.client, 'cancel_entry', { id: others.id, expectedRevision: 1 }, 'FORBIDDEN');
    // finance is hidden: refused and nothing readable
    await deny(mgr.client, 'finance_month_totals', { projectId: A.id }, /FORBIDDEN|NOT_FOUND/);
    await deny(mgr.client, 'create_transaction', { requestId: ID(), projectId: A.id, fields }, /FORBIDDEN|NOT_FOUND/);
    const tx = await mgr.client.from('transactions').select('id').eq('project_id', A.id);
    expect(tx.data ?? []).toEqual([]);
    await deny(mgr.client, 'finance_all_month_totals', {}, 'FORBIDDEN');
    // the other project does not exist for them
    await deny(mgr.client, 'create_entry', entry(B.id), 'NOT_FOUND');
    await deny(mgr.client, 'project_permissions', { projectId: B.id }, 'NOT_FOUND');
    // Ben only: access, finance opening, status
    await deny(mgr.client, 'set_membership', { userId: wrk.id, projectId: A.id, role: 'manager', expectedRevision: 1 }, 'FORBIDDEN');
    await deny(mgr.client, 'remove_membership', { userId: wrk.id, projectId: A.id, expectedRevision: 1 }, 'FORBIDDEN');
    await deny(mgr.client, 'set_finance_access', { userId: mgr.id, projectId: A.id, enabled: true, expectedRevision: 1 }, 'FORBIDDEN');
    await deny(mgr.client, 'set_project_status', { id: A.id, expectedRevision: A.revision, status: 'completed' }, 'FORBIDDEN');
  });

  it('manager with finance opened by Ben: sees finance of A only, still cannot manage access or see other projects\' finance', async () => {
    await ok(fin.client, 'create_transaction', { requestId: ID(), projectId: A.id, fields });
    expect(JSON.stringify(await ok(fin.client, 'finance_month_totals', { projectId: A.id }))).toMatch(/"income":[1-9]/);
    await deny(fin.client, 'finance_month_totals', { projectId: B.id }, 'NOT_FOUND');
    await deny(fin.client, 'finance_all_month_totals', {}, 'FORBIDDEN');
    await deny(fin.client, 'set_membership', { userId: fin.id, projectId: A.id, role: 'manager', expectedRevision: 1 }, 'FORBIDDEN');
  });

  it('worker (worker on A): reports and notes only; no documents, no finance, no access, no other project', async () => {
    expect(await visibleProjects(wrk.client)).toEqual([A.id]);
    await ok(wrk.client, 'create_task', task(A.id));
    const mine1 = await value<Saved>(wrk.client, 'create_entry', entry(A.id));
    await ok(wrk.client, 'correct_entry', { id: mine1.id, expectedRevision: 1, body: 'תיקון עצמי', fileIds: [] });
    await deny(wrk.client, 'move_entry', { id: mine1.id, expectedRevision: 2, projectId: A.id, workDate: '2026-01-02' }, 'FORBIDDEN');
    await deny(wrk.client, 'cancel_entry', { id: mine1.id, expectedRevision: 2 }, 'FORBIDDEN');
    await deny(wrk.client, 'begin_upload', { projectId: A.id, purpose: 'document', files: [] }, 'FORBIDDEN');
    await deny(wrk.client, 'project_access_candidates', { projectId: A.id }, 'FORBIDDEN');
    await deny(wrk.client, 'finance_month_totals', { projectId: A.id }, /FORBIDDEN|NOT_FOUND/);
    await deny(wrk.client, 'create_entry', entry(B.id), 'NOT_FOUND');
    await deny(wrk.client, 'set_membership', { userId: wrk.id, projectId: A.id, role: 'manager', expectedRevision: 1 }, 'FORBIDDEN');
    await deny(wrk.client, 'create_project', { requestId: ID(), fields: { name: 'x', businessName: 'x', siteAddress: 'x', contact: { name: 'x', phone: '0', email: null, roleTitle: null }, startDate: null, endDate: null, accessNotes: null } }, 'FORBIDDEN');
  });

  it('documents: the uploader sets access; owner-only, all and selected are enforced for every role', async () => {
    const onlyBen = await doc(mgr, A.id, { mode: 'owner' });
    const everyone = await doc(mgr, A.id, { mode: 'all' });
    const forWorker = await doc(mgr, A.id, { mode: 'selected', userIds: [wrk.id] });
    expect(await rows(ben.client, 'documents', onlyBen.saved.id)).toHaveLength(1);
    expect(await rows(wrk.client, 'documents', onlyBen.saved.id)).toHaveLength(0);
    expect(await rows(fin.client, 'documents', onlyBen.saved.id)).toHaveLength(0);
    expect(await rows(wrk.client, 'documents', everyone.saved.id)).toHaveLength(1);
    expect(await rows(wrk.client, 'documents', forWorker.saved.id)).toHaveLength(1);
    expect(await rows(fin.client, 'documents', forWorker.saved.id)).toHaveLength(0);
    await deny(wrk.client, 'authorize_file', { fileId: onlyBen.fileId, variant: 'original' }, 'NOT_FOUND');
    await ok(wrk.client, 'authorize_file', { fileId: forWorker.fileId, variant: 'original' });
    await deny(fin.client, 'authorize_file', { fileId: forWorker.fileId, variant: 'original' }, 'NOT_FOUND');
    // after upload only Ben changes access
    await deny(mgr.client, 'set_document_access', { id: everyone.saved.id, expectedRevision: 1, access: { mode: 'owner' } }, 'FORBIDDEN');
    await ok(ben.client, 'set_document_access', { id: everyone.saved.id, expectedRevision: 1, access: { mode: 'owner' } });
    expect(await rows(wrk.client, 'documents', everyone.saved.id)).toHaveLength(0);
  });

  it('mixed person (manager on A, worker on B): each project uses that project\'s role, in both directions', async () => {
    expect(await visibleProjects(mix.client)).toEqual([A.id, B.id].sort());
    // A: manager powers
    expect(await ok(mix.client, 'project_access_candidates', { projectId: A.id })).toBeDefined();
    await doc(mix, A.id, { mode: 'all' });
    // B: worker only
    await deny(mix.client, 'project_access_candidates', { projectId: B.id }, 'FORBIDDEN');
    await deny(mix.client, 'begin_upload', { projectId: B.id, purpose: 'document', files: [] }, 'FORBIDDEN');
    const onB = await value<Saved>(mix.client, 'create_entry', entry(B.id));
    const bossOnB = await value<Saved>(ben.client, 'create_entry', entry(B.id));
    await ok(mix.client, 'correct_entry', { id: onB.id, expectedRevision: 1, body: 'תיקון עצמי', fileIds: [] });
    await deny(mix.client, 'correct_entry', { id: bossOnB.id, expectedRevision: 1, body: 'x', fileIds: [] }, 'FORBIDDEN');
    // no finance anywhere until Ben opens it, and opening it on A does not open B
    await deny(mix.client, 'finance_month_totals', { projectId: A.id }, /FORBIDDEN|NOT_FOUND/);
    await deny(mix.client, 'finance_month_totals', { projectId: B.id }, /FORBIDDEN|NOT_FOUND/);
    const m = await value<{ revision: number }>(ben.client, 'set_membership', { userId: mix.id, projectId: A.id, role: 'manager', expectedRevision: mixOnA.revision });
    await ok(ben.client, 'set_finance_access', { userId: mix.id, projectId: A.id, enabled: true, expectedRevision: m.revision });
    expect(JSON.stringify(await ok(mix.client, 'finance_month_totals', { projectId: A.id }))).toMatch(/"income":[1-9]/);
    await deny(mix.client, 'finance_month_totals', { projectId: B.id }, /FORBIDDEN|NOT_FOUND/);
    // never access management, in either role
    await deny(mix.client, 'set_membership', { userId: mgr.id, projectId: A.id, role: 'worker', expectedRevision: 1 }, 'FORBIDDEN');
    await deny(mix.client, 'set_membership', { userId: mgr.id, projectId: B.id, role: 'worker', expectedRevision: null }, 'FORBIDDEN');
  });

  it('finished project: manager and worker can only read; Ben can still write; reopening restores writes', async () => {
    await membership(ben.client, mgr.id, C.id, 'manager');
    await membership(ben.client, wrk.id, C.id, 'worker');
    const own = await value<Saved>(wrk.client, 'create_entry', entry(C.id));
    const t = await value<Saved>(wrk.client, 'create_task', task(C.id));
    const done = await value<Saved>(ben.client, 'set_project_status', { id: C.id, expectedRevision: C.revision, status: 'completed' });
    const readOnly: [TestActor, Parameters<typeof rpc>[1], Json][] = [
      [wrk, 'create_entry', entry(C.id)],
      [wrk, 'correct_entry', { id: own.id, expectedRevision: 1, body: 'x', fileIds: [] }],
      [wrk, 'create_task', task(C.id)],
      [wrk, 'update_task', { id: t.id, expectedRevision: 1, body: 'x', dueDate: null }],
      [mgr, 'create_task', task(C.id)],
      [mgr, 'create_entry', entry(C.id)],
      [mgr, 'begin_upload', { projectId: C.id, purpose: 'document', files: [] }],
    ];
    for (const [who, name, input] of readOnly) await deny(who.client, name, input, 'PROJECT_READ_ONLY');
    expect(await rows(wrk.client, 'diary_entries', own.id)).toHaveLength(1); // viewing and printing stay
    expect(await ok(wrk.client, 'diary_summary', { projectId: C.id })).toBeDefined();
    await ok(ben.client, 'create_task', task(C.id));
    await ok(ben.client, 'set_project_status', { id: C.id, expectedRevision: done.revision, status: 'active' });
    await ok(wrk.client, 'create_task', task(C.id));
  });

  it('removing access takes everything away at once, and only Ben can do it', async () => {
    const extra = await actor(admin, ben.client, 'cext');
    mine.push(extra);
    const m = await membership(ben.client, extra.id, A.id, 'worker');
    const mine1 = await value<Saved>(extra.client, 'create_entry', entry(A.id));
    await deny(wrk.client, 'remove_membership', { userId: extra.id, projectId: A.id, expectedRevision: m.revision }, 'FORBIDDEN');
    await deny(mgr.client, 'remove_membership', { userId: extra.id, projectId: A.id, expectedRevision: m.revision }, 'FORBIDDEN');
    await ok(ben.client, 'remove_membership', { userId: extra.id, projectId: A.id, expectedRevision: m.revision });
    expect(await rows(extra.client, 'projects', A.id)).toEqual([]);
    expect(await rows(extra.client, 'diary_entries', mine1.id)).toEqual([]);
    await deny(extra.client, 'create_entry', entry(A.id), 'NOT_FOUND');
  });
});
