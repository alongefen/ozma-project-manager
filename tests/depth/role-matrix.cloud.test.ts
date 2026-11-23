import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Json } from '../../src/types/database';
import { actor, clients, membership, owner, project, rpc, value, type Client, type TestActor } from '../db/support/cloud';

// P1.4.10 depth gate: a role x function sweep straight against the Data API with real JWTs.
// Existing suites (tests/db/permissions.test.ts P01-P31, tests/logic/**) cover the detailed behaviour;
// this file closes the catalog-wide gaps: every function has a declared class, owner-only functions
// refuse every other role, project-scoped functions hide foreign projects, and anonymous callers
// and service-only functions are refused for everyone.
const ID = () => randomUUID();
type Role = 'owner' | 'financeManager' | 'manager' | 'worker' | 'outsider' | 'anonymous';
const ownerOnly: Record<string, () => Json> = {
  create_profile: () => ({ requestId: ID(), email: `x-${ID()}@example.invalid`, fullName: 'בדוי' }),
  update_profile: () => ({ id: ID(), expectedRevision: 1, fullName: 'בדוי' }),
  complete_profile_creation: () => ({ requestId: ID(), userId: ID() }),
  prepare_profile_update: () => ({ id: ID(), expectedRevision: 1, fullName: 'בדוי', email: `x-${ID()}@example.invalid` }),
  set_user_active: () => ({ id: ID(), active: false, expectedRevision: 1 }),
  revoke_user_sessions: () => ({ id: ID() }),
  set_membership: () => ({ userId: ID(), projectId: ID(), role: 'worker', expectedRevision: null }),
  remove_membership: () => ({ userId: ID(), projectId: ID(), expectedRevision: 1 }),
  set_finance_access: () => ({ userId: ID(), projectId: ID(), enabled: true, expectedRevision: 1 }),
  create_project: () => ({ requestId: ID(), fields: { name: 'x', businessName: 'x', siteAddress: 'x', contact: { name: 'x', phone: '0', email: null, roleTitle: null }, startDate: null, endDate: null, accessNotes: null } }),
  set_project_status: () => ({ id: ID(), expectedRevision: 1, status: 'completed' }),
  set_project_archived: () => ({ id: ID(), expectedRevision: 1, archived: true }),
  set_project_cover: () => ({ projectId: ID(), expectedRevision: 1, fileId: null }),
  set_document_access: () => ({ id: ID(), expectedRevision: 1, access: { mode: 'all' } }),
  set_document_archived: () => ({ id: ID(), expectedRevision: 1, archived: true }),
  finance_all_month_totals: () => ({}),
};
// Callable by authorised project members; the project gate hides foreign projects (NOT_FOUND) or refuses by role.
const projectScoped = ['update_project', 'create_task', 'update_task', 'set_task_completed', 'delete_task', 'begin_upload', 'create_document', 'create_entry', 'correct_entry', 'move_entry', 'cancel_entry', 'create_transaction', 'update_transaction', 'cancel_transaction', 'set_finance_link', 'project_permissions', 'project_access_candidates', 'project_manager_names', 'get_pending_upload', 'authorize_file', 'diary_summary', 'finance_month_totals'];
const sessionScoped = ['get_actor', 'project_cards'];
const serviceOnly = ['system_bootstrap_owner', 'system_owner_recovered', 'system_finish_upload'];
const all = [...Object.keys(ownerOnly), ...projectScoped, ...sessionScoped, ...serviceOnly];

let admin: Client, anonymous: Client, people: Record<Exclude<Role, 'anonymous'>, TestActor>, a: { id: string; revision: number };
const clientOf = (role: Role) => (role === 'anonymous' ? anonymous : people[role].client);
const call = (role: Role, name: string, input: Json) => rpc(clientOf(role), name as never, input);

beforeAll(async () => {
  ({ admin, anonymous } = clients());
  const ben = await owner(admin);
  people = { owner: ben, financeManager: await actor(admin, ben.client, 'dfin'), manager: await actor(admin, ben.client, 'dmgr'), worker: await actor(admin, ben.client, 'dwrk'), outsider: await actor(admin, ben.client, 'dout') };
  a = await project(ben.client, 'depth-matrix');
  await membership(ben.client, people.financeManager.id, a.id, 'manager');
  await membership(ben.client, people.manager.id, a.id, 'manager');
  await membership(ben.client, people.worker.id, a.id, 'worker');
  await value(ben.client, 'set_finance_access', { userId: people.financeManager.id, projectId: a.id, enabled: true, expectedRevision: 1 });
}, 120_000);

// Soft cleanup of this file's own project only: archive it (nothing is physically deleted).
afterAll(async () => {
  const ben = people?.owner;
  if (!ben || !a) return;
  const row = await ben.client.from('projects').select('revision').eq('id', a.id).single();
  if (row.data) await rpc(ben.client, 'set_project_archived', { id: a.id, expectedRevision: row.data.revision, archived: true });
}, 60_000);

describe.sequential('depth gate: role x function sweep', () => {
  it('classifies every function in the generated database types (new functions need a row here)', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/types/database.ts', 'utf8');
    const section = src.slice(src.indexOf('    Functions: {'), src.indexOf('    Enums: {'));
    const names = [...section.matchAll(/^ {6}(\w+): \{ Args/gm)].map(m => m[1]);
    expect(names.length).toBeGreaterThan(40);
    expect(names.filter(n => !all.includes(n))).toEqual([]);
    expect(all.filter(n => !names.includes(n))).toEqual([]);
  });

  for (const [name, input] of Object.entries(ownerOnly)) {
    it(`${name}: owner-only; the other four roles and anonymous are refused, the owner passes the gate`, async () => {
      for (const role of ['financeManager', 'manager', 'worker', 'outsider', 'anonymous'] as Role[]) {
        const r = await call(role, name, input());
        expect(r.error, `${name} as ${role}`).not.toBeNull();
        if (role !== 'anonymous') expect(r.error?.message, `${name} as ${role}`).toBe('FORBIDDEN');
      }
      const r = await call('owner', name, input());
      expect(r.error?.message ?? '').not.toBe('FORBIDDEN');
      expect(r.error?.message ?? '').not.toMatch(/permission denied/i);
    });
  }

  it('anonymous callers are refused by every function', async () => {
    for (const name of all) {
      const r = await call('anonymous', name, {});
      expect(r.error, `${name} as anonymous`).not.toBeNull();
    }
  });

  it('service-only functions are refused to every signed-in role, owner included', async () => {
    for (const name of serviceOnly) for (const role of ['owner', 'financeManager', 'manager', 'worker', 'outsider'] as Role[]) {
      const r = await call(role, name, {});
      expect(r.error, `${name} as ${role}`).not.toBeNull();
    }
  });

  it('project-scoped functions never reveal or act on a project the caller cannot see', async () => {
    const foreign = ID();
    const probes: Record<string, Json> = {
      update_project: { id: foreign, expectedRevision: 1, fields: {} },
      create_task: { requestId: ID(), projectId: foreign, body: 'x', dueDate: null, completed: false },
      create_entry: { requestId: ID(), projectId: foreign, workDate: '2026-01-01', body: 'x', fileIds: [] },
      create_transaction: { requestId: ID(), projectId: foreign, fields: { year: 2026, month: 1, day: null, kind: 'income', amount: 1, details: 'x' } },
      set_finance_link: { projectId: foreign, expectedRevision: 1, url: null },
      project_permissions: { projectId: foreign },
      project_access_candidates: { projectId: foreign },
      project_manager_names: { projectId: foreign },
      finance_month_totals: { projectId: foreign },
    };
    for (const [name, input] of Object.entries(probes)) for (const role of ['owner', 'financeManager', 'manager', 'worker', 'outsider'] as Role[]) {
      const r = await call(role, name, input);
      expect(r.error, `${name} as ${role} on a missing project`).not.toBeNull();
      expect(r.error?.message, `${name} as ${role}`).toBe('NOT_FOUND');
    }
    for (const name of ['project_permissions', 'project_access_candidates', 'project_manager_names', 'finance_month_totals']) {
      const r = await call('outsider', name, { projectId: a.id });
      expect(r.error?.message, `${name} as outsider on a real project`).toBe('NOT_FOUND');
    }
  });

  it('project-role matrix on a real project: who may read, write and see finance', async () => {
    const task = (role: Role) => call(role, 'create_task', { requestId: ID(), projectId: a.id, body: 'מטריצה', dueDate: null, completed: false });
    for (const role of ['owner', 'financeManager', 'manager', 'worker'] as Role[]) expect((await task(role)).error, `create_task as ${role}`).toBeNull();
    expect((await task('outsider')).error?.message).toBe('NOT_FOUND');
    const tx = (role: Role) => call(role, 'create_transaction', { requestId: ID(), projectId: a.id, fields: { year: 2026, month: 1, day: null, kind: 'income', amount: 12345, details: 'מטריצה' } });
    for (const role of ['owner', 'financeManager'] as Role[]) expect((await tx(role)).error, `create_transaction as ${role}`).toBeNull();
    for (const role of ['manager', 'worker'] as Role[]) expect((await tx(role)).error, `create_transaction as ${role}`).not.toBeNull();
    expect((await tx('outsider')).error?.message).toBe('NOT_FOUND');
    for (const role of ['owner', 'financeManager'] as Role[]) {
      const r = await call(role, 'finance_month_totals', { projectId: a.id });
      expect(r.error, `finance_month_totals as ${role}`).toBeNull();
    }
    for (const role of ['manager', 'worker'] as Role[]) expect((await call(role, 'finance_month_totals', { projectId: a.id })).error, `finance_month_totals as ${role}`).not.toBeNull();
    // diary_summary does not error for a stranger; it must reveal nothing.
    const stranger = await call('outsider', 'diary_summary', { projectId: a.id });
    expect(stranger.error === null ? (stranger.data as { reportCount?: number }).reportCount ?? 0 : 0).toBe(0);
    const base = { id: a.id, expectedRevision: a.revision, fields: { name: `מטריצה ${a.id}`, businessName: 'בדוי', siteAddress: 'x', contact: { name: 'x', phone: '0', email: null, roleTitle: null }, startDate: null, endDate: null, accessNotes: null } };
    expect((await call('worker', 'update_project', base)).error?.message).toBe('FORBIDDEN');
    expect((await call('outsider', 'update_project', base)).error?.message).toBe('NOT_FOUND');
    expect((await call('manager', 'update_project', base)).error).toBeNull();
  });
});
