import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { actor, clients, environment, membership, owner, project, readyFile, rpc, value, type Client, type TestActor } from '../db/support/cloud';

// P3.1 security, direct access: PostgREST, Storage and Auth with real JWTs, no app code in between.
// Fake data only (@example.invalid). Cleanup touches only rows this file made: its two projects are archived,
// its accounts are deactivated (accounts cannot be deleted by the app), its test storage objects are removed.
const ID = () => randomUUID();
const NIL = '00000000-0000-0000-0000-000000000000';
type Saved = { id: string; revision: number };
const tables = ['diary_attachments', 'diary_entries', 'diary_version_files', 'diary_versions', 'document_grants', 'documents', 'memberships', 'profiles',
  'project_contacts', 'project_covers', 'project_finance_settings', 'project_private', 'projects', 'sensitive_events', 'stored_files', 'tasks', 'transactions'] as const;
let admin: Client, anonymous: Client;
let ben: TestActor, mgr: TestActor, fin: TestActor, wrk: TestActor, out: TestActor;
let A: Saved, B: Saved;
const mine: TestActor[] = [];
const objects: string[] = [];
const each = (people: Record<string, Client>) => Object.entries(people);
const everyone = () => each({ anonymous, service: admin, outsider: out.client, worker: wrk.client, manager: mgr.client, financeManager: fin.client, owner: ben.client });
const env = () => environment();
// A column that exists in every table, so the privilege check (42501) is what fails, not column resolution (42703).
const types = readFileSync('src/types/database.ts', 'utf8');
const firstColumn = (table: string) => {
  const at = types.indexOf(`      ${table}: {\n        Row: {`);
  const m = /\n {10}(\w+):/.exec(types.slice(at, at + 600));
  if (at < 0 || !m) throw new Error(`no columns found for ${table}`);
  return m[1];
};

beforeAll(async () => {
  ({ admin, anonymous } = clients());
  ben = await owner(admin);
  [mgr, fin, wrk, out] = await Promise.all(['smgr', 'sfin', 'swrk', 'sout'].map(l => actor(admin, ben.client, l)));
  mine.push(mgr, fin, wrk, out);
  [A, B] = [await project(ben.client, 'אבטחה-א'), await project(ben.client, 'אבטחה-ב')];
  await membership(ben.client, mgr.id, A.id, 'manager');
  const f = await membership(ben.client, fin.id, A.id, 'manager');
  await value(ben.client, 'set_finance_access', { userId: fin.id, projectId: A.id, enabled: true, expectedRevision: f.revision });
  await membership(ben.client, wrk.id, A.id, 'worker');
  // project B has its own data that nobody on A may reach
  await value(ben.client, 'create_task', { requestId: ID(), projectId: B.id, body: 'פתק בדוי ב', dueDate: null, completed: false });
  await value(ben.client, 'create_entry', { requestId: ID(), projectId: B.id, workDate: '2026-01-01', body: 'דיווח בדוי ב', fileIds: [] });
  await value(ben.client, 'create_transaction', { requestId: ID(), projectId: B.id, fields: { year: 2026, month: 1, day: null, kind: 'income', amount: 777, details: 'תנועה בדויה ב' } });
  await value(ben.client, 'create_transaction', { requestId: ID(), projectId: A.id, fields: { year: 2026, month: 1, day: null, kind: 'income', amount: 555, details: 'תנועה בדויה א' } });
  const fileId = await readyFile(admin, ben, B.id, 'document');
  await value(ben.client, 'create_document', { projectId: B.id, fileId, category: 'plans', access: { mode: 'all' } });
}, 240_000);

afterAll(async () => {
  if (admin && objects.length) await admin.storage.from('originals').remove(objects);
  if (!ben) return;
  for (const p of [A, B].filter(Boolean)) {
    const row = await ben.client.from('projects').select('revision').eq('id', p.id).single();
    if (row.data) await rpc(ben.client, 'set_project_archived', { id: p.id, expectedRevision: row.data.revision, archived: true });
  }
  for (const person of mine) {
    const row = await ben.client.from('profiles').select('revision').eq('id', person.id).single();
    if (row.data) await rpc(ben.client, 'set_user_active', { id: person.id, active: false, expectedRevision: row.data.revision });
  }
}, 120_000);

describe.sequential('X15: no writes outside database functions, for every table and every caller', () => {
  for (const table of tables) {
    it(`${table}: INSERT, UPDATE and DELETE are refused for anonymous, service_role and every role (owner included)`, async () => {
      for (const [who, client] of everyone()) {
        const ins = await client.from(table).insert({} as never);
        expect(ins.error?.code, `${who} insert ${table}`).toBe('42501');
        const col = firstColumn(table) as never;
        const upd = await client.from(table).update({ [col as string]: null } as never).not(col, 'is', null) // PostgREST skips an empty PATCH body, so send a real column;
        expect(upd.error?.code, `${who} update ${table}`).toBe('42501');
        const del = await client.from(table).delete().not(col, 'is', null);
        expect(del.error?.code, `${who} delete ${table}`).toBe('42501');
      }
    });
  }
  it('upsert and truncate-like bulk calls are refused too', async () => {
    for (const [who, client] of everyone()) {
      const up = await client.from('projects').upsert({ id: NIL, name: 'x' } as never);
      expect(up.error, who).not.toBeNull();
    }
  });
});

describe.sequential('reads: anonymous and service_role see nothing; others see only what RLS grants', () => {
  for (const table of tables) {
    it(`${table}: anonymous and service_role cannot read it`, async () => {
      for (const client of [anonymous, admin]) expect((await client.from(table).select('*').limit(1)).error?.code).toBe('42501');
    });
  }
  it('the private schema, the REST schema listing and unknown tables are not reachable', async () => {
    for (const client of [anonymous, wrk.client, ben.client]) {
      expect((await client.schema('private' as never).from('anything' as never).select('*')).error).not.toBeNull();
      expect((await client.from('pg_catalog.pg_user' as never).select('*')).error).not.toBeNull();
      expect((await client.from('users' as never).select('*')).error).not.toBeNull();
    }
    const e = env();
    const root = await fetch(`${e.url}/rest/v1/`, { headers: { apikey: e.publishable } });
    const body = await root.text();
    expect(root.status === 200 && body.includes('"definitions"'), 'OpenAPI schema must not be served to the publishable key').toBe(false);
    const authUsers = await fetch(`${e.url}/auth/v1/admin/users`, { headers: { apikey: e.publishable, Authorization: `Bearer ${wrk.client ? (await wrk.client.auth.getSession()).data.session?.access_token : ''}` } });
    expect(authUsers.status).toBeGreaterThanOrEqual(400);
  });
  it('cross-project: a manager, a worker and a finance manager on A read nothing of B in any table', async () => {
    for (const [who, client] of each({ manager: mgr.client, worker: wrk.client, financeManager: fin.client, outsider: out.client })) {
      for (const [table, column] of [['projects', 'id'], ['tasks', 'project_id'], ['diary_entries', 'project_id'], ['documents', 'project_id'], ['transactions', 'project_id'],
        ['project_contacts', 'project_id'], ['project_finance_settings', 'project_id'], ['project_private', 'project_id'], ['memberships', 'project_id'], ['stored_files', 'project_id']] as const) {
        const r = await client.from(table).select('*').eq(column as never, B.id);
        expect(r.error, `${who} ${table}`).toBeNull();
        expect(r.data ?? [], `${who} sees B in ${table}`).toEqual([]);
      }
    }
  });
  it('finance visibility: owner and the opened manager see transactions; the plain manager, the worker and the outsider see none, on A as well', async () => {
    const count = async (c: Client, p: string) => ((await c.from('transactions').select('id').eq('project_id', p)).data ?? []).length;
    expect(await count(ben.client, A.id)).toBeGreaterThan(0);
    expect(await count(ben.client, B.id)).toBeGreaterThan(0);
    expect(await count(fin.client, A.id)).toBeGreaterThan(0);
    expect(await count(fin.client, B.id)).toBe(0);
    for (const c of [mgr.client, wrk.client, out.client]) expect(await count(c, A.id)).toBe(0);
    for (const c of [mgr.client, wrk.client, out.client]) expect(((await c.from('project_finance_settings').select('*').eq('project_id', A.id)).data ?? [])).toEqual([]);
    for (const c of [mgr.client, wrk.client, fin.client]) {
      expect(((await c.from('project_private').select('*')).data ?? [])).toEqual([]); // company number: owner only
      expect(((await c.from('sensitive_events').select('*')).data ?? [])).toEqual([]);
      expect(((await c.from('document_grants').select('*')).data ?? [])).toEqual([]);
    }
  });
  it('profiles and memberships: a non-owner sees only their own rows', async () => {
    for (const p of [mgr, wrk, fin, out]) {
      const profiles = await p.client.from('profiles').select('id');
      expect((profiles.data ?? []).map(r => r.id)).toEqual(p === out ? [out.id] : [p.id]);
      const ms = await p.client.from('memberships').select('user_id');
      expect((ms.data ?? []).every(r => r.user_id === p.id)).toBe(true);
    }
  });
  it('a worker cannot read any file row of a document that is owner-only or from another project', async () => {
    const fileId = await readyFile(admin, mgr, A.id, 'document');
    await value(mgr.client, 'create_document', { projectId: A.id, fileId, category: 'plans', access: { mode: 'owner' } });
    expect(((await wrk.client.from('stored_files').select('id').eq('id', fileId)).data ?? [])).toEqual([]);
    expect((await rpc(wrk.client, 'authorize_file', { fileId, variant: 'original' })).error?.message).toBe('NOT_FOUND');
    expect((await rpc(out.client, 'authorize_file', { fileId, variant: 'original' })).error?.message).toBe('NOT_FOUND');
    expect((await rpc(anonymous, 'authorize_file', { fileId, variant: 'original' })).error).not.toBeNull();
  });
});

describe.sequential('upload limits and types (begin_upload)', () => {
  const OFFICE = ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
  const file = (mime: string, sizeBytes: unknown = 8, name = 'בדיקה') => ({ clientId: ID(), name, mime, sizeBytes });
  const begin = (c: Client, purpose: string, files: unknown[], projectId = A.id) => rpc(c, 'begin_upload', { projectId, purpose, files } as never);
  it('rejects types that are not on the allow-list for every purpose', async () => {
    for (const mime of ['text/html', 'image/svg+xml', 'application/x-msdownload', 'application/javascript', 'application/zip', 'application/x-sh', 'text/plain', 'application/vnd.ms-excel.sheet.macroEnabled.12', 'application/vnd.ms-word.document.macroEnabled.12', '', 'image/png; charset=x'])
      for (const purpose of ['document', 'diary']) expect((await begin(mgr.client, purpose, [file(mime)])).error?.message, `${purpose} ${mime}`).toBe('LIMIT');
  });
  it('Office types are for documents only: a diary report and a cover refuse them', async () => {
    for (const mime of OFFICE) {
      expect((await begin(wrk.client, 'diary', [file(mime)])).error?.message, mime).toBe('LIMIT');
      expect((await begin(ben.client, 'cover', [file(mime)])).error?.message, mime).toBe('LIMIT');
    }
    expect((await begin(ben.client, 'cover', [file('application/pdf')])).error?.message).toBe('LIMIT');
  });
  it('size: documents up to 50MB, diary and cover up to 25MB; zero, negative, fractional, text and huge are refused', async () => {
    for (const bad of [0, -1, 52428801, 9007199254740991, 1.5, 'abc', null, '1; drop table']) {
      const r = await begin(mgr.client, 'document', [file('application/pdf', bad)]);
      expect(r.error, `document size ${String(bad)}`).not.toBeNull();
    }
    expect((await begin(wrk.client, 'diary', [file('image/png', 26214401)])).error?.message).toBe('LIMIT');
    expect((await begin(ben.client, 'cover', [file('image/png', 26214401)])).error?.message).toBe('LIMIT');
    // boundaries that are accepted (each leaves one pending row of this test; pending rows are unreadable by anyone else)
    expect((await begin(mgr.client, 'document', [file(OFFICE[1], 52428800, 'מסמך.docx')])).error).toBeNull();
    expect((await begin(wrk.client, 'diary', [file('image/png', 26214400)])).error).toBeNull();
  });
  it('count and shape: 0 or 21 files, extra or missing keys, bad purpose and non-array are refused', async () => {
    expect((await begin(mgr.client, 'document', [])).error?.message).toBe('LIMIT');
    expect((await begin(mgr.client, 'document', Array.from({ length: 21 }, () => file('image/png')))).error?.message).toBe('LIMIT');
    expect((await begin(mgr.client, 'document', [{ ...file('image/png'), path: '../../x' }])).error).not.toBeNull();
    expect((await begin(mgr.client, 'document', [{ clientId: ID(), name: 'x', mime: 'image/png' }])).error).not.toBeNull();
    expect((await begin(mgr.client, 'avatar', [file('image/png')])).error).not.toBeNull();
    expect((await rpc(mgr.client, 'begin_upload', { projectId: A.id, purpose: 'document', files: 'x' } as never)).error).not.toBeNull();
    expect((await rpc(mgr.client, 'begin_upload', { projectId: A.id, purpose: 'document', files: [file('image/png')], uploadedBy: ben.id } as never)).error).not.toBeNull();
  });
  it('who may start an upload: manager documents, worker diary, owner cover; outsider and another project are refused', async () => {
    expect((await begin(wrk.client, 'document', [file('image/png')])).error?.message).toBe('FORBIDDEN');
    expect((await begin(mgr.client, 'cover', [file('image/png')])).error?.message).toBe('FORBIDDEN');
    expect((await begin(wrk.client, 'cover', [file('image/png')])).error?.message).toBe('FORBIDDEN');
    expect((await begin(out.client, 'diary', [file('image/png')])).error?.message).toBe('NOT_FOUND');
    expect((await begin(mgr.client, 'document', [file('image/png')], B.id)).error?.message).toBe('NOT_FOUND');
    expect((await begin(anonymous, 'diary', [file('image/png')])).error).not.toBeNull();
  });
  it('a file name cannot steer the storage path: the path is project/uuid, built by the database', async () => {
    const r = await begin(mgr.client, 'document', [file('image/png', 8, '../../../etc/passwd')]);
    expect(r.error).toBeNull();
    const row = (r.data as { path: string }[])[0];
    expect(row.path).toMatch(new RegExp(`^${A.id}/[0-9a-f-]{36}$`));
  });
});

describe.sequential('storage: no direct access for any caller; signed links are short-lived and bound to one object', () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
  let path: string, otherPath: string;
  beforeAll(async () => {
    path = `${A.id}/${ID()}`; otherPath = `${B.id}/${ID()}`;
    for (const p of [path, otherPath]) {
      const up = await admin.storage.from('originals').upload(p, png, { contentType: 'image/png', upsert: false });
      expect(up.error).toBeNull();
      objects.push(p);
    }
  });
  it('every caller except service_role: list, download, public URL, upload, overwrite, move, copy, remove and signing are refused', async () => {
    for (const [who, client] of each({ anonymous, outsider: out.client, worker: wrk.client, manager: mgr.client, financeManager: fin.client, owner: ben.client })) {
      for (const bucket of ['originals', 'display']) {
        const s = client.storage.from(bucket);
        expect((await s.list(path.split('/')[0])).data ?? [], `${who} list ${bucket}`).toEqual([]);
        if (bucket === 'originals') {
          expect((await s.download(path)).error, `${who} download`).not.toBeNull();
          expect((await s.createSignedUrl(path, 60)).error, `${who} sign`).not.toBeNull();
          expect((await s.upload(`${A.id}/${ID()}`, png, { contentType: 'image/png' })).error, `${who} upload`).not.toBeNull();
          expect((await s.upload(path, png, { upsert: true, contentType: 'image/png' })).error, `${who} overwrite`).not.toBeNull();
          expect((await s.move(path, `${A.id}/${ID()}`)).error, `${who} move`).not.toBeNull();
          expect((await s.copy(path, `${A.id}/${ID()}`)).error, `${who} copy`).not.toBeNull();
          const removal = await s.remove([path]);
          expect(removal.error !== null || (removal.data ?? []).length === 0, `${who} remove`).toBe(true);
        }
      }
      expect((await client.storage.listBuckets()).data ?? [], `${who} buckets`).toEqual([]);
    }
    const e = env();
    const pub = await fetch(`${e.url}/storage/v1/object/public/originals/${path}`);
    expect(pub.ok).toBe(false);
    const auth = await fetch(`${e.url}/storage/v1/object/authenticated/originals/${path}`, { headers: { apikey: e.publishable } });
    expect(auth.ok).toBe(false);
    expect((await admin.storage.from('originals').download(path)).error).toBeNull(); // the object is really there
  });
  it('a signed link is time-limited, tamper-proof and bound to its own object', async () => {
    const e = env();
    const signed = await admin.storage.from('originals').createSignedUrl(path, 5);
    expect(signed.error).toBeNull();
    const url = signed.data!.signedUrl;
    expect((await fetch(url)).ok).toBe(true);
    const token = new URL(url).searchParams.get('token')!;
    const other = `${e.url}/storage/v1/object/sign/originals/${otherPath}?token=${token}`;
    expect((await fetch(other)).ok, 'token of one object must not open another').toBe(false);
    const forged = `${e.url}/storage/v1/object/sign/originals/${path}?token=${token.slice(0, -4)}AAAA`;
    expect((await fetch(forged)).ok, 'tampered token').toBe(false);
    const none = `${e.url}/storage/v1/object/sign/originals/${path}`;
    expect((await fetch(none)).ok, 'no token').toBe(false);
    await new Promise(r => setTimeout(r, 6500));
    expect((await fetch(url)).ok, 'expired link').toBe(false);
  }, 30_000);
  it('an upload token works once for its own path only; a second use, another path and an overwrite are refused', async () => {
    const mineId = ID();
    const own = `${A.id}/${mineId}`;
    const t = await admin.storage.from('originals').createSignedUploadUrl(own, { upsert: false });
    expect(t.error).toBeNull();
    objects.push(own);
    const first = await anonymous.storage.from('originals').uploadToSignedUrl(own, t.data!.token, png, { contentType: 'image/png' });
    expect(first.error).toBeNull();
    const again = await anonymous.storage.from('originals').uploadToSignedUrl(own, t.data!.token, Buffer.from('x'), { contentType: 'image/png', upsert: true });
    expect(again.error, 'second use / overwrite').not.toBeNull();
    const elsewhere = await anonymous.storage.from('originals').uploadToSignedUrl(`${B.id}/${ID()}`, t.data!.token, png, { contentType: 'image/png' });
    expect(elsewhere.error, 'token for another path').not.toBeNull();
    expect((await admin.storage.from('originals').download(own)).data?.size).toBe(png.length);
  });
  it('the app side of a link: authorize_file refuses by role and project, and a 60-second link is the only way to bytes', async () => {
    const fileId = await readyFile(admin, mgr, A.id, 'document');
    await value(mgr.client, 'create_document', { projectId: A.id, fileId, category: 'plans', access: { mode: 'selected', userIds: [wrk.id] } });
    expect((await rpc(wrk.client, 'authorize_file', { fileId, variant: 'original' })).error).toBeNull();
    for (const c of [fin.client, out.client, anonymous]) expect((await rpc(c, 'authorize_file', { fileId, variant: 'original' })).error).not.toBeNull();
    expect((await rpc(wrk.client, 'authorize_file', { fileId: NIL, variant: 'original' })).error?.message).toBe('NOT_FOUND');
    expect((await rpc(wrk.client, 'authorize_file', { fileId, variant: '../x' } as never)).error).not.toBeNull();
  });
});

describe.sequential('access after removal, deactivation and session revocation (same JWT, no re-login)', () => {
  const sees = async (c: Client) => ((await c.from('projects').select('id').eq('id', A.id)).data ?? []).length;
  it('removal from the project closes reads, RPCs and files at once; the other project stays', async () => {
    const x = await actor(admin, ben.client, 'srem'); mine.push(x);
    const a = await membership(ben.client, x.id, A.id, 'worker');
    await membership(ben.client, x.id, B.id, 'worker');
    expect(await sees(x.client)).toBe(1);
    await value(ben.client, 'remove_membership', { userId: x.id, projectId: A.id, expectedRevision: a.revision });
    expect(await sees(x.client)).toBe(0);
    expect((await x.client.from('tasks').select('id').eq('project_id', A.id)).data ?? []).toEqual([]);
    expect((await rpc(x.client, 'create_task', { requestId: ID(), projectId: A.id, body: 'x', dueDate: null, completed: false })).error?.message).toBe('NOT_FOUND');
    expect(((await x.client.from('projects').select('id').eq('id', B.id)).data ?? []).length).toBe(1);
  });
  it('deactivation blocks the unexpired JWT everywhere; reactivation does not revive the old session', async () => {
    const x = await actor(admin, ben.client, 'sdea'); mine.push(x);
    await membership(ben.client, x.id, A.id, 'manager');
    const before = await ben.client.from('profiles').select('revision').eq('id', x.id).single();
    const off = await value<Saved>(ben.client, 'set_user_active', { id: x.id, active: false, expectedRevision: before.data!.revision });
    expect(await sees(x.client)).toBe(0);
    expect((await rpc(x.client, 'get_actor', {})).data ?? null).toBeFalsy();
    expect((await rpc(x.client, 'create_task', { requestId: ID(), projectId: A.id, body: 'x', dueDate: null, completed: false })).error).not.toBeNull();
    expect((await rpc(x.client, 'project_cards', {})).data ?? []).toEqual([]);
    expect(((await x.client.from('profiles').select('id')).data ?? [])).toEqual([]);
    await value(ben.client, 'set_user_active', { id: x.id, active: true, expectedRevision: off.revision });
    expect(await sees(x.client), 'the session that was open during deactivation stays dead').toBe(0);
  });
  it('revoking sessions kills the open JWT, and a refreshed token of that session is refused too', async () => {
    const x = await actor(admin, ben.client, 'srev'); mine.push(x);
    await membership(ben.client, x.id, A.id, 'worker');
    const session = (await x.client.auth.getSession()).data.session!;
    expect(await sees(x.client)).toBe(1);
    await value(ben.client, 'revoke_user_sessions', { id: x.id });
    expect(await sees(x.client)).toBe(0);
    const refreshed = await x.client.auth.refreshSession({ refresh_token: session.refresh_token });
    // The refresh token may still mint a token (the app's reset also signs the user out at Auth), but it stays the same
    // revoked session, so the database must keep refusing it.
    if (refreshed.data.session) expect(await sees(x.client), 'refreshed token of a revoked session').toBe(0);
  });
  it('logging out everywhere blocks the JWT that has not expired yet', async () => {
    const x = await actor(admin, ben.client, 'slog'); mine.push(x);
    await membership(ben.client, x.id, A.id, 'worker');
    expect(await sees(x.client)).toBe(1);
    expect((await x.client.auth.signOut({ scope: 'global' })).error).toBeNull();
    expect(await sees(x.client)).toBe(0);
  });
  it('a worker cannot promote themselves, open finance for themselves or change another membership (direct RPC)', async () => {
    const m = (await wrk.client.from('memberships').select('revision').eq('user_id', wrk.id).eq('project_id', A.id).single()).data!;
    for (const [c, who] of [[wrk.client, 'worker'], [mgr.client, 'manager'], [fin.client, 'finance manager']] as const) {
      expect((await rpc(c, 'set_membership', { userId: wrk.id, projectId: A.id, role: 'manager', expectedRevision: m.revision })).error?.message, who).toBe('FORBIDDEN');
      expect((await rpc(c, 'set_finance_access', { userId: wrk.id, projectId: A.id, enabled: true, expectedRevision: m.revision })).error?.message, who).toBe('FORBIDDEN');
      expect((await rpc(c, 'set_user_active', { id: ben.id, active: false, expectedRevision: 1 })).error?.message, who).toBe('FORBIDDEN');
    }
    const own = (await ben.client.from('profiles').select('revision').eq('id', ben.id).single()).data!;
    const self = await rpc(ben.client, 'set_user_active', { id: ben.id, active: false, expectedRevision: own.revision }); // real revision: the owner rule decides, not a conflict
    expect(self.error).not.toBeNull();
    expect(self.error?.message).not.toBe('CONFLICT');
  });
  it('JWT claims cannot be forged: a self-signed or altered token reads nothing', async () => {
    const good = (await wrk.client.auth.getSession()).data.session!.access_token;
    const [h, p, s] = good.split('.');
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString()) as Record<string, unknown>;
    const e = env();
    const attempts = [
      `${h}.${Buffer.from(JSON.stringify({ ...payload, sub: ben.id })).toString('base64url')}.${s}`,
      `${h}.${Buffer.from(JSON.stringify({ ...payload, role: 'service_role' })).toString('base64url')}.${s}`,
      `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ ...payload, sub: ben.id, role: 'service_role' })).toString('base64url')}.`,
    ];
    for (const token of attempts) {
      const r = await fetch(`${e.url}/rest/v1/projects?select=id`, { headers: { apikey: e.publishable, Authorization: `Bearer ${token}` } });
      const body = await r.text();
      expect(r.status === 200 && body !== '[]', 'forged token must not read anything').toBe(false);
    }
  });
});
