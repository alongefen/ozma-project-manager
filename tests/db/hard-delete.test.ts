import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Json } from '../../src/types/database';
import { actor, clients, login, membership, project, rpc, value, type Client, type TestActor } from './support/cloud';

// HARD-DELETE (A-44) end to end with real JWTs and REAL storage objects. Fake data only (@example.invalid).
// Runs only on a throwaway project created here; it never touches other projects or accounts.
vi.mock('server-only', () => ({}));
const { drainStorageQueue } = await import('../../src/features/projects/logic/hard-delete');

let admin: Client, anonymous: Client, ben: TestActor, manager: TestActor, worker: TestActor;
const call = (client: Client, name: string, input: Json) => rpc(client, name as never, input);
async function deny(client: Client, name: string, input: Json, code: string) {
  const r = await call(client, name, input);
  expect(r.error, `${name} should refuse`).not.toBeNull();
  expect(r.error?.message).toBe(code);
}
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
type Paths = { bucket: string; path: string; display: string };
/** A ready file with a REAL original object and a REAL display copy in Storage. */
async function realFile(projectId: string, uploader: TestActor, purpose: 'document' | 'diary' | 'cover'): Promise<{ id: string; paths: Paths }> {
  const files = await value<{ fileId: string; bucket: string; path: string }[]>(uploader.client, 'begin_upload', {
    projectId, purpose, files: [{ clientId: randomUUID(), name: `בדיקה-${randomUUID()}.png`, mime: 'image/png', sizeBytes: 8 }] });
  const { fileId, bucket, path } = files[0];
  const display = `${projectId}/${fileId}.jpg`;
  expect((await admin.storage.from(bucket).upload(path, png, { contentType: 'image/png' })).error).toBeNull();
  expect((await admin.storage.from('display').upload(display, png, { contentType: 'image/jpeg' })).error).toBeNull();
  await value(admin, 'system_finish_upload', { fileId, actorId: uploader.id, sessionId: uploader.sessionId, state: 'ready', mime: 'image/png', sizeBytes: 8, sha256: 'a'.repeat(64), displayState: 'ready', displayPath: display });
  return { id: fileId, paths: { bucket, path, display } };
}
const rowsOf = async (t: string, col: string, v: string) => (await ben.client.from(t as 'projects').select('*').eq(col as 'id', v)).data;
const exists = async (bucket: string, path: string) => !(await admin.storage.from(bucket).download(path)).error;
const nameOf = async (fileId: string) => (await ben.client.from('stored_files').select('original_name').eq('id', fileId).single()).data!.original_name;
const pending = async () => (await value<{ id: number; path: string }[]>(admin, 'system_storage_pending', {}));
async function expectStorageGone(paths: Paths[]) {
  for (const p of paths) { expect(await exists(p.bucket, p.path), p.path).toBe(false); expect(await exists('display', p.display), p.display).toBe(false); }
}

const made: string[] = [];
/** A fake owner-level account of our own (the shared helper bootstraps the first owner, which is no longer possible with real owners). */
async function fakeOwner(): Promise<TestActor> {
  const email = `hd-owner-${randomUUID()}@example.invalid`, password = randomBytes(32).toString('base64url');
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error('createUser failed');
  await value(admin, 'system_add_owner' as never, { userId: data.user.id, fullName: 'אדמין בדוי למחיקה סופית' });
  return login(email, password);
}
beforeAll(async () => {
  ({ admin, anonymous } = clients()); ben = await fakeOwner();
  manager = await actor(admin, ben.client, 'hdm'); worker = await actor(admin, ben.client, 'hdw');
}, 120_000);
afterAll(async () => { // leave nothing behind: every project made here is deleted by the feature itself if still present
  for (const id of made) {
    const row = (await ben.client.from('projects').select('name,revision,archived_at').eq('id', id).maybeSingle()).data;
    if (!row) continue;
    if (!row.archived_at) await rpc(ben.client, 'set_project_archived', { id, expectedRevision: row.revision, archived: true });
    await rpc(ben.client, 'hard_delete_project', { id, confirmName: row.name });
  }
  await drainStorageQueue(() => admin);
}, 120_000);
async function newProject(label: string) {
  const p = await project(ben.client, label); made.push(p.id);
  await membership(ben.client, manager.id, p.id, 'manager'); await membership(ben.client, worker.id, p.id, 'worker');
  return p;
}
const projectName = async (id: string) => (await ben.client.from('projects').select('name').eq('id', id).single()).data!.name;

describe.sequential('מחיקה סופית (HARD-DELETE, A-44)', () => {
  it('מסמך: רק בעלים, רק מארכיון, שם מוקלד, והקובץ נמחק באמת מהאחסון', async () => {
    const p = await newProject('hd-doc');
    const f = await realFile(p.id, ben, 'document'); const name = await nameOf(f.id);
    const doc = await value<{ id: string; revision: number }>(ben.client, 'create_document', { projectId: p.id, fileId: f.id, category: 'plans', access: { mode: 'all' } });
    const input = { id: doc.id, confirmName: name };
    for (const who of [manager, worker]) await deny(who.client, 'hard_delete_document', input, 'FORBIDDEN');
    expect((await call(anonymous, 'hard_delete_document', input)).error?.message).toMatch(/permission denied|JWT/i);
    await deny(ben.client, 'hard_delete_document', input, 'CONFLICT');                       // active document
    const archived = await value<{ revision: number }>(ben.client, 'set_document_archived', { id: doc.id, expectedRevision: doc.revision, archived: true });
    expect(archived.revision).toBeGreaterThan(doc.revision);
    await deny(ben.client, 'hard_delete_document', { id: doc.id, confirmName: 'אחר' }, 'VALIDATION');
    await deny(ben.client, 'hard_delete_document', { id: doc.id }, 'VALIDATION');
    expect(await exists(f.paths.bucket, f.paths.path)).toBe(true);                           // refusals deleted nothing
    const done = await value<{ deleted: { files: number }; storage: unknown[] }>(ben.client, 'hard_delete_document', input);
    expect(done.deleted.files).toBe(1); expect(done.storage).toHaveLength(2);
    expect((await ben.client.from('documents').select('id').eq('id', doc.id)).data).toEqual([]);
    expect((await ben.client.from('stored_files').select('id').eq('id', f.id)).data).toEqual([]);
    expect((await pending()).filter(r => r.path.startsWith(p.id))).toHaveLength(2);          // queued until the server removes them
    expect(await drainStorageQueue(() => admin)).toBe(0);
    await expectStorageGone([f.paths]);
    expect((await pending()).filter(r => r.path.startsWith(p.id))).toEqual([]);
    const audit = await ben.client.from('sensitive_events').select('action,after,project_id').eq('entity_id', doc.id);
    expect(audit.data).toEqual([{ action: 'document.deleted', after: { name }, project_id: p.id }]);   // old history gone, one minimal row
  }, 120_000);

  it('דיווח יומן: מבוטל בלבד, כל הגרסאות והקבצים נמחקים, ה-PDF לפי תאריך ממשיך לעבוד', async () => {
    const p = await newProject('hd-entry');
    const f = await realFile(p.id, worker, 'diary');
    const entry = await value<{ id: string; revision: number }>(worker.client, 'create_entry', { requestId: randomUUID(), projectId: p.id, workDate: '2026-11-01', body: 'דיווח בדוי', fileIds: [f.id] });
    const keep = await value<{ id: string }>(worker.client, 'create_entry', { requestId: randomUUID(), projectId: p.id, workDate: '2026-11-01', body: 'נשאר', fileIds: [] });
    const input = { id: entry.id, confirmName: '01/11/2026' };
    for (const who of [manager, worker]) await deny(who.client, 'hard_delete_entry', input, 'FORBIDDEN');
    await deny(ben.client, 'hard_delete_entry', input, 'CONFLICT');                         // active entry
    await value(ben.client, 'cancel_entry', { id: entry.id, expectedRevision: entry.revision });
    await deny(ben.client, 'hard_delete_entry', { id: entry.id }, 'VALIDATION');             // has a file: name required
    await deny(ben.client, 'hard_delete_entry', { id: entry.id, confirmName: '02/11/2026' }, 'VALIDATION');
    const done = await value<{ deleted: { versions: number; files: number } }>(ben.client, 'hard_delete_entry', input);
    expect(done.deleted.files).toBe(1); expect(done.deleted.versions).toBeGreaterThanOrEqual(2);
    for (const t of ['diary_entries', 'diary_versions', 'diary_attachments', 'diary_version_files'] as const) {
      const col = t === 'diary_entries' ? 'id' : 'entry_id';
      expect(await rowsOf(t, col, entry.id), t).toEqual([]);
    }
    expect((await ben.client.from('stored_files').select('id').eq('id', f.id)).data).toEqual([]);
    expect(await drainStorageQueue(() => admin)).toBe(0); await expectStorageGone([f.paths]);
    // the day still lists the other report: nothing references the deleted rows
    const day = await ben.client.from('diary_entries').select('id').eq('project_id', p.id).eq('work_date', '2026-11-01').is('cancelled_at', null);
    expect(day.data).toEqual([{ id: keep.id }]);
    const summary = await call(ben.client, 'diary_summary', { projectId: p.id, from: '2026-11-01', to: '2026-11-01' });
    expect(summary.error).toBeNull();
    expect((await ben.client.from('sensitive_events').select('action').eq('entity_id', entry.id)).data).toEqual([{ action: 'entry.deleted' }]);
  }, 120_000);

  it('תנועה כספית: מבוטלת בלבד, וההיסטוריה שלה נמחקת', async () => {
    const p = await newProject('hd-tx');
    const tx = await value<{ id: string; revision: number }>(ben.client, 'create_transaction', { requestId: randomUUID(), projectId: p.id, fields: { year: 2026, month: 11, day: null, kind: 'income', amount: 4242, details: 'תנועה בדויה' } });
    for (const who of [manager, worker]) await deny(who.client, 'hard_delete_transaction', { id: tx.id }, 'FORBIDDEN');
    await deny(ben.client, 'hard_delete_transaction', { id: tx.id }, 'CONFLICT');
    await value(ben.client, 'cancel_transaction', { id: tx.id, expectedRevision: tx.revision });
    await value(ben.client, 'hard_delete_transaction', { id: tx.id });
    expect((await ben.client.from('transactions').select('id').eq('id', tx.id)).data).toEqual([]);
    expect((await ben.client.from('sensitive_events').select('action,after').eq('entity_id', tx.id)).data).toEqual([{ action: 'transaction.deleted', after: {} }]);
    await deny(ben.client, 'hard_delete_transaction', { id: tx.id }, 'NOT_FOUND');
  }, 120_000);

  it('פרויקט: רק אחרי ארכוב, שם מוקלד, הכול נמחק בלי יתומים, ושום דבר אחר לא נפגע', async () => {
    const keepP = await newProject('hd-keep');
    const keepFile = await realFile(keepP.id, ben, 'diary');
    const keepEntry = await value<{ id: string }>(ben.client, 'create_entry', { requestId: randomUUID(), projectId: keepP.id, workDate: '2026-11-05', body: 'לא לגעת', fileIds: [keepFile.id] });
    const p = await newProject('hd-project'); const name = await projectName(p.id);
    const doc = await realFile(p.id, ben, 'document'); const diary = await realFile(p.id, worker, 'diary'); const cover = await realFile(p.id, ben, 'cover');
    await value(ben.client, 'create_document', { projectId: p.id, fileId: doc.id, category: 'plans', access: { mode: 'all' } });
    await value(worker.client, 'create_entry', { requestId: randomUUID(), projectId: p.id, workDate: '2026-11-02', body: 'פנימי', fileIds: [diary.id] });
    await value(ben.client, 'create_transaction', { requestId: randomUUID(), projectId: p.id, fields: { year: 2026, month: 11, day: null, kind: 'expense', amount: 99, details: 'פנימי' } });
    await value(ben.client, 'create_task', { requestId: randomUUID(), projectId: p.id, body: 'משימה', dueDate: null, completed: false });
    const now = (await ben.client.from('projects').select('revision').eq('id', p.id).single()).data!;
    await value(ben.client, 'set_project_cover', { id: p.id, expectedRevision: now.revision, fileId: cover.id });

    const preview = await value<{ eligible: boolean; requiresName: boolean; counts: Record<string, number> }>(ben.client, 'hard_delete_preview', { kind: 'project', id: p.id });
    expect(preview).toMatchObject({ eligible: false, requiresName: true, counts: { reports: 1, documents: 1, transactions: 1, tasks: 1, files: 3 } });
    for (const who of [manager, worker]) { await deny(who.client, 'hard_delete_project', { id: p.id, confirmName: name }, 'FORBIDDEN'); await deny(who.client, 'hard_delete_preview', { kind: 'project', id: p.id }, 'FORBIDDEN'); }
    expect((await call(anonymous, 'hard_delete_project', { id: p.id, confirmName: name })).error).not.toBeNull();
    await deny(ben.client, 'hard_delete_project', { id: p.id, confirmName: name }, 'CONFLICT');     // active project
    const cur = (await ben.client.from('projects').select('revision').eq('id', p.id).single()).data!;
    await value(ben.client, 'set_project_status', { id: p.id, expectedRevision: cur.revision, status: 'completed' });   // finished is also deletable
    await deny(ben.client, 'hard_delete_project', { id: p.id, confirmName: `${name} ` + 'x' }, 'VALIDATION');
    await deny(ben.client, 'hard_delete_project', { id: p.id }, 'VALIDATION');
    for (const who of [manager, worker]) await deny(who.client, 'hard_delete_project', { id: p.id, confirmName: name }, 'FORBIDDEN');   // finished: still no
    expect(await exists(doc.paths.bucket, doc.paths.path)).toBe(true);

    const done = await value<{ deleted: Record<string, number>; storage: unknown[] }>(ben.client, 'hard_delete_project', { id: p.id, confirmName: name });
    expect(done.deleted).toEqual({ reports: 1, documents: 1, transactions: 1, files: 3 }); expect(done.storage).toHaveLength(6);
    for (const [t, col] of [['projects', 'id'], ['memberships', 'project_id'], ['project_contacts', 'project_id'], ['project_private', 'project_id'], ['project_finance_settings', 'project_id'], ['tasks', 'project_id'], ['stored_files', 'project_id'], ['project_covers', 'project_id'], ['documents', 'project_id'], ['diary_entries', 'project_id'], ['diary_versions', 'project_id'], ['transactions', 'project_id'], ['sensitive_events', 'project_id']] as const) {
      expect(await rowsOf(t, col, p.id), t).toEqual([]);
    }
    expect(await drainStorageQueue(() => admin)).toBe(0);
    await expectStorageGone([doc.paths, diary.paths, cover.paths]);
    expect((await pending()).filter(r => r.path.startsWith(p.id))).toEqual([]);
    const audit = await ben.client.from('sensitive_events').select('action,project_id,after').eq('entity_id', p.id);
    expect(audit.data).toEqual([{ action: 'project.deleted', project_id: null, after: { name, counts: { reports: 1, documents: 1, transactions: 1, files: 3 } } }]);
    // another project is untouched
    expect((await ben.client.from('diary_entries').select('id').eq('id', keepEntry.id)).data).toHaveLength(1);
    expect(await exists(keepFile.paths.bucket, keepFile.paths.path)).toBe(true);
    await deny(ben.client, 'hard_delete_project', { id: p.id, confirmName: name }, 'NOT_FOUND');
  }, 180_000);

  it('אי אפשר עדיין למחוק בדרכים הישנות: גם בעלים נחסם', async () => {
    const p = await newProject('hd-immutable');
    const f = await realFile(p.id, worker, 'diary');
    const entry = await value<{ id: string; revision: number }>(worker.client, 'create_entry', { requestId: randomUUID(), projectId: p.id, workDate: '2026-11-03', body: 'x', fileIds: [f.id] });
    await value(ben.client, 'cancel_entry', { id: entry.id, expectedRevision: entry.revision });
    for (const t of ['diary_versions', 'diary_version_files', 'diary_attachments', 'sensitive_events', 'diary_entries', 'stored_files', 'transactions'] as const) {
      for (const client of [ben.client, manager.client, worker.client, admin]) {
        const r = await client.from(t as 'projects').delete().eq('id', randomUUID());
        expect(r.error, `${t} delete`).not.toBeNull();           // no DELETE grant for any API role (the triggers are the second wall)
      }
    }
    // a cancelled entry stays immutable for the old edit path
    await deny(ben.client, 'correct_entry', { id: entry.id, expectedRevision: entry.revision + 1, body: 'y', fileIds: [] }, 'CONFLICT');
    // after a REFUSED hard delete (wrong name) nothing changed and the protections are intact
    await deny(ben.client, 'hard_delete_entry', { id: entry.id, confirmName: 'x' }, 'VALIDATION');
    expect((await ben.client.from('diary_versions').select('version').eq('entry_id', entry.id)).data!.length).toBeGreaterThanOrEqual(2);
  }, 120_000);
});
