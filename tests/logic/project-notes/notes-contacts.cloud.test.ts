import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Platform, RequestContext, Result } from '../../../src/types/contracts';
vi.mock('server-only', () => ({}));
import { createNotesApi } from '../../../src/features/projects/notes/logic';
import { createContactsApi } from '../../../src/features/projects/contacts/logic';
import { rpc } from '../../../src/lib/db/rpc';
import { permissions } from '../../../src/lib/permissions';
import { cloudOwner, cloudActor } from '../../auth/support/cloud';

const notes = createNotesApi({ rpc, permissions } as Platform);
const contacts = createContactsApi({ rpc, permissions } as Platform);
function value<T>(r: Result<T>): T { expect(r.ok).toBe(true); if (!r.ok) throw new Error(r.error.code); return r.value; }
let ben: RequestContext, worker: RequestContext, manager: RequestContext, outsider: RequestContext, p: string, finished: string;
async function raw(name: string, input: unknown) { return value(await rpc<unknown, { id: string; revision: number }>(ben, name, input)); }
const project = (label: string) => raw('create_project', { requestId: randomUUID(), fields: { name: `CFB ${label} ${randomUUID()}`, businessName: 'בדוי', siteAddress: 'בדיקה', contact: { name: 'בדוי', phone: '0', email: null, roleTitle: null }, startDate: null, endDate: null, accessNotes: null } });
const note = (projectId: string) => ({ requestId: randomUUID(), projectId, body: 'הערה בדויה' });
const contact = (projectId: string) => ({ requestId: randomUUID(), projectId, name: 'איש קשר בדוי', roleTitle: 'תפקיד', phone: '050-0000000' });

beforeAll(async () => {
  ben = await cloudOwner();
  worker = (await cloudActor(ben, 'cfb-worker')).ctx; manager = (await cloudActor(ben, 'cfb-manager')).ctx; outsider = (await cloudActor(ben, 'cfb-outsider')).ctx;
  p = (await project('open')).id; finished = (await project('finished')).id;
  for (const projectId of [p, finished]) for (const [ctx, role] of [[worker, 'worker'], [manager, 'manager']] as const) await raw('set_membership', { projectId, userId: ctx.actor.userId, role, expectedRevision: null });
}, 180000);

describe.sequential('הערות ואנשי קשר בענן', () => {
  it('notes: any member writes, retry is idempotent, newest first, author edits own, others cannot, owner can', async () => {
    const input = note(p);
    const a = value(await notes.createNote(worker, input));
    expect(value(await notes.createNote(worker, input))).toEqual(a);
    const b = value(await notes.createNote(manager, note(p)));
    const list = value(await notes.listNotes(worker, { projectId: p }));
    expect(list.notes.map(n => n.id).slice(0, 2)).toEqual([b.id, a.id]);
    expect(list).toMatchObject({ canWrite: true, isOwner: false });
    expect(await notes.updateNote(manager, { id: a.id, expectedRevision: a.revision, body: 'חטיפה' })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(await notes.cancelNote(manager, { id: a.id, expectedRevision: a.revision })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    const edited = value(await notes.updateNote(worker, { id: a.id, expectedRevision: a.revision, body: 'תוקן' }));
    expect(await notes.updateNote(worker, { id: a.id, expectedRevision: a.revision, body: 'ישן' })).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
    value(await notes.updateNote(ben, { id: a.id, expectedRevision: edited.revision, body: 'בן' }));
    expect(value(await notes.listNotes(manager, { projectId: p })).notes.find(n => n.id === a.id)).toMatchObject({ body: 'בן', editedAt: expect.any(String) });
  });
  it('notes: cancelled disappear and cannot be edited; non-members see and write nothing', async () => {
    const s = value(await notes.createNote(worker, note(p)));
    value(await notes.cancelNote(worker, { id: s.id, expectedRevision: s.revision }));
    expect(value(await notes.listNotes(worker, { projectId: p })).notes.some(n => n.id === s.id)).toBe(false);
    expect(await notes.updateNote(worker, { id: s.id, expectedRevision: s.revision + 1, body: 'x' })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(await notes.listNotes(outsider, { projectId: p })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(await notes.createNote(outsider, note(p))).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(await notes.createNote(worker, note(randomUUID()))).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });
  it('contacts: manager and owner write; worker reads but every write is refused; non-member sees nothing', async () => {
    const c = value(await contacts.createContact(manager, contact(p)));
    const w = value(await contacts.listContacts(worker, { projectId: p }));
    expect(w.canWrite).toBe(false); expect(w.contacts.find(x => x.id === c.id)).toMatchObject({ name: 'איש קשר בדוי', roleTitle: 'תפקיד' });
    expect(await contacts.createContact(worker, contact(p))).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(await contacts.updateContact(worker, { id: c.id, expectedRevision: c.revision, name: 'x', roleTitle: null, phone: '1' })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(await contacts.removeContact(worker, { id: c.id, expectedRevision: c.revision })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(await contacts.listContacts(outsider, { projectId: p })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(await contacts.createContact(outsider, contact(p))).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    const u = value(await contacts.updateContact(manager, { id: c.id, expectedRevision: c.revision, name: 'עודכן', roleTitle: null, phone: '051' }));
    expect(await contacts.updateContact(ben, { id: c.id, expectedRevision: c.revision, name: 'ישן', roleTitle: null, phone: '1' })).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
    value(await contacts.removeContact(ben, { id: c.id, expectedRevision: u.revision }));
    expect(value(await contacts.listContacts(manager, { projectId: p })).contacts.some(x => x.id === c.id)).toBe(false);
  });
  it('finished project: members read but cannot write notes or contacts; the owner still can', async () => {
    const n = value(await notes.createNote(worker, note(finished)));
    const c = value(await contacts.createContact(manager, contact(finished)));
    await raw('set_project_status', { id: finished, expectedRevision: 1, status: 'completed' });
    for (const ctx of [worker, manager]) {
      expect(value(await notes.listNotes(ctx, { projectId: finished })).canWrite).toBe(false);
      expect(value(await contacts.listContacts(ctx, { projectId: finished })).canWrite).toBe(false);
    }
    expect(await notes.createNote(worker, note(finished))).toMatchObject({ ok: false, error: { code: 'PROJECT_READ_ONLY' } });
    expect(await notes.updateNote(worker, { id: n.id, expectedRevision: n.revision, body: 'x' })).toMatchObject({ ok: false, error: { code: 'PROJECT_READ_ONLY' } });
    expect(await notes.cancelNote(worker, { id: n.id, expectedRevision: n.revision })).toMatchObject({ ok: false, error: { code: 'PROJECT_READ_ONLY' } });
    expect(await contacts.createContact(manager, contact(finished))).toMatchObject({ ok: false, error: { code: 'PROJECT_READ_ONLY' } });
    expect(await contacts.removeContact(manager, { id: c.id, expectedRevision: c.revision })).toMatchObject({ ok: false, error: { code: 'PROJECT_READ_ONLY' } });
    value(await notes.createNote(ben, note(finished)));
  });
});
