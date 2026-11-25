import { describe, expect, it, vi } from 'vitest';
import type { Platform, RequestContext } from '../../../src/types/contracts';
vi.mock('server-only', () => ({}));
import { createNotesApi } from '../../../src/features/projects/notes/logic';
import { createContactsApi } from '../../../src/features/projects/contacts/logic';
import { canChange, parseNote } from '../../../src/features/projects/notes/shared/model';
import { parseDraft } from '../../../src/features/projects/contacts/shared/model';

const id = '27f5161e-b0d8-47e2-8383-2bf19087b718';
const perms = (over = {}) => ({ ok: true, value: { view: true, writeTasks: true, editDetails: false, ...over } });
function setup(table: unknown[], over = {}) {
  const rpc = vi.fn().mockResolvedValue({ ok: true, value: { id, revision: 1 } });
  const forProject = vi.fn().mockResolvedValue(perms(over));
  const query: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order']) query[m] = () => query;
  query.limit = () => Promise.resolve({ data: table, error: null });
  const ctx = { actor: { userId: 'u1', isOwner: false }, db: { from: vi.fn(() => query) } } as unknown as RequestContext;
  const platform = { rpc, permissions: { forProject } } as unknown as Platform;
  return { rpc, forProject, ctx, platform };
}

describe('project notes', () => {
  it('lists newest first from RLS and reports write permission and viewer', async () => {
    const { ctx, platform } = setup([{ id, body: 'א', author_id: 'u1', author_name: 'דנה', created_at: '2026-11-25T08:00:00Z', edited_at: null, revision: 1 }]);
    const r = await createNotesApi(platform).listNotes(ctx, { projectId: id });
    expect(r).toMatchObject({ ok: true, value: { canWrite: true, viewerId: 'u1', isOwner: false, notes: [{ id, authorName: 'דנה', body: 'א' }] } });
  });
  it('hides a project the viewer cannot see', async () => {
    const { ctx, platform } = setup([], { view: false });
    expect(await createNotesApi(platform).listNotes(ctx, { projectId: id })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });
  it.each([
    ['createNote', 'create_project_note', { requestId: id, projectId: id, body: 'הערה' }],
    ['updateNote', 'update_project_note', { id, expectedRevision: 2, body: 'תיקון' }],
    ['cancelNote', 'cancel_project_note', { id, expectedRevision: 3 }],
  ] as const)('%s goes only through %s', async (method, rpcName, input) => {
    const { ctx, platform, rpc } = setup([]);
    const api = createNotesApi(platform) as unknown as Record<string, (c: RequestContext, i: unknown) => Promise<{ ok: boolean }>>;
    expect((await api[method](ctx, input)).ok).toBe(true);
    expect(rpc).toHaveBeenCalledExactlyOnceWith(ctx, rpcName, input);
  });
  it.each([{ requestId: id, projectId: id, body: '   ' }, { requestId: id, projectId: id, body: 'א'.repeat(5001) }, { requestId: id, projectId: id, body: 'x', author: 'y' }])('rejects invalid create before the database', async input => {
    const { ctx, platform, rpc } = setup([]);
    expect(await createNotesApi(platform).createNote(ctx, input as never)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(rpc).not.toHaveBeenCalled();
  });
  it('view model: edit and cancel only for the author or an owner-level account, never when read-only', () => {
    expect(canChange({ authorId: 'a' }, 'a', false, true)).toBe(true);
    expect(canChange({ authorId: 'a' }, 'b', false, true)).toBe(false);
    expect(canChange({ authorId: 'a' }, 'b', true, true)).toBe(true);
    expect(canChange({ authorId: 'a' }, 'a', false, false)).toBe(false);
    expect(parseNote('  ')).toMatchObject({ ok: false });
    expect(parseNote(' שלום ')).toEqual({ ok: true, body: 'שלום' });
  });
});

describe('project extra contacts', () => {
  it('lists contacts; write permission follows editDetails (managers), not the worker task permission', async () => {
    const row = { id, name: 'יוסי', role_title: null, phone: '050-0000000', revision: 1 };
    const worker = setup([row], { writeTasks: true, editDetails: false });
    expect(await createContactsApi(worker.platform).listContacts(worker.ctx, { projectId: id })).toMatchObject({ ok: true, value: { canWrite: false, contacts: [{ name: 'יוסי', roleTitle: null }] } });
    const manager = setup([row], { editDetails: true });
    expect(await createContactsApi(manager.platform).listContacts(manager.ctx, { projectId: id })).toMatchObject({ ok: true, value: { canWrite: true } });
  });
  it.each([
    ['createContact', 'create_project_contact', { requestId: id, projectId: id, name: 'יוסי', roleTitle: 'חשמלאי', phone: '050' }],
    ['updateContact', 'update_project_contact', { id, expectedRevision: 2, name: 'יוסי', roleTitle: null, phone: '050' }],
    ['removeContact', 'remove_project_contact', { id, expectedRevision: 3 }],
  ] as const)('%s goes only through %s', async (method, rpcName, input) => {
    const { ctx, platform, rpc } = setup([]);
    const api = createContactsApi(platform) as unknown as Record<string, (c: RequestContext, i: unknown) => Promise<{ ok: boolean }>>;
    expect((await api[method](ctx, input)).ok).toBe(true);
    expect(rpc).toHaveBeenCalledExactlyOnceWith(ctx, rpcName, input);
  });
  it('turns an empty role into null and rejects an empty name or phone', async () => {
    const { ctx, platform, rpc } = setup([]);
    await createContactsApi(platform).createContact(ctx, { requestId: id, projectId: id, name: ' יוסי ', roleTitle: '  ', phone: ' 050 ' });
    expect(rpc).toHaveBeenCalledWith(ctx, 'create_project_contact', { requestId: id, projectId: id, name: 'יוסי', roleTitle: null, phone: '050' });
    expect(await createContactsApi(platform).createContact(ctx, { requestId: id, projectId: id, name: '', roleTitle: null, phone: '1' })).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(parseDraft({ name: 'א', roleTitle: '', phone: ' ' })).toMatchObject({ ok: false, errors: { phone: 'שדה חובה' } });
    expect(parseDraft({ name: 'א', roleTitle: '', phone: '1' })).toEqual({ ok: true, name: 'א', roleTitle: null, phone: '1' });
  });
});
