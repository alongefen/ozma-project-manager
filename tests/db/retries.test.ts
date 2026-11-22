import { randomBytes, randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { ProfileCreationResultSchema, UploadCompletionSchema } from '../../src/types/contracts/schemas';
import type { Json } from '../../src/types/database';
import { actor, clients, login, membership, owner, project, rpc, value, type Client, type TestActor } from './support/cloud';

type Saved = { id: string; revision: number };
let admin: Client, anonymous: Client, ben: TestActor, manager: TestActor, otherManager: TestActor;
let sharedProject: Saved;
async function deny(client: Client, name: Parameters<typeof rpc>[1], input: Json, code?: string) {
  const result = await rpc(client, name, input);
  expect(result.error, `${name} should reject`).not.toBeNull();
  if (code) expect(result.error?.message).toBe(code);
}
async function pending(uploader = manager, projectId = sharedProject.id) {
  const [file] = await value<{ fileId: string }[]>(uploader.client, 'begin_upload', {
    projectId, purpose: 'document', files: [{ clientId: randomUUID(), name: 'בדיקת חזרה.png', mime: 'image/png', sizeBytes: 8 }],
  });
  return { fileId: file.fileId, actorId: uploader.id, sessionId: uploader.sessionId,
    state: 'ready', mime: 'image/png', sizeBytes: 8, sha256: 'a'.repeat(64), displayPath: null, displayState: 'none' };
}
async function fileRow(fileId: string) {
  const { data, error } = await ben.client.from('stored_files').select('*').eq('id', fileId).single();
  expect(error).toBeNull();
  return data;
}

beforeAll(async () => {
  ({ admin, anonymous } = clients());
  ben = await owner(admin);
  manager = await actor(admin, ben.client, 'retry-manager', true);
  otherManager = await actor(admin, ben.client, 'retry-other-manager', true);
  sharedProject = await project(ben.client, 'ניסיונות חוזרים');
  await membership(ben.client, manager.id, sharedProject.id, 'manager');
  await membership(ben.client, otherManager.id, sharedProject.id, 'manager');
}, 120_000);

describe.sequential('השלמת העלאה חוזרת עם JWT אמיתי', () => {
  it('משחזר תגובה שאבדה למנהל שהעלה קובץ שטרם חובר לישות, בלי כתיבה נוספת', async () => {
    const input = await pending();
    const first = await value(admin, 'system_finish_upload', input);
    const before = await fileRow(input.fileId);
    // The uploader has no general read access until the file is attached to an entity.
    await deny(manager.client, 'authorize_file', { fileId: input.fileId, variant: 'original' }, 'NOT_FOUND');
    expect((await manager.client.from('stored_files').select('id').eq('id', input.fileId)).data).toEqual([]);
    expect(UploadCompletionSchema.parse(await value(manager.client, 'get_pending_upload', { fileId: input.fileId }))).toMatchObject({ state: 'ready', fileRef: first });
    expect(await value(admin, 'system_finish_upload', input)).toEqual(first);
    expect(await fileRow(input.fileId)).toEqual(before);
  });

  it('דוחה שינוי בתוצאת האימות או במצב אחרי השלמה ושומר את המקור', async () => {
    const input = await pending();
    await value(admin, 'system_finish_upload', input);
    const before = await fileRow(input.fileId);
    for (const patch of [{ sha256: 'b'.repeat(64) }, { state: 'rejected' }, { sizeBytes: 9 }, { displayState: 'failed' }]) {
      await deny(admin, 'system_finish_upload', { ...input, ...patch });
    }
    expect(await fileRow(input.fileId)).toEqual(before);
  });

  it('אינו נותן למנהל אחר, לאורח או לסשן אחר לשחזר השלמה', async () => {
    const input = await pending();
    await value(admin, 'system_finish_upload', input);
    await deny(otherManager.client, 'get_pending_upload', { fileId: input.fileId }, 'NOT_FOUND');
    await deny(anonymous, 'get_pending_upload', { fileId: input.fileId });
    await deny(manager.client, 'system_finish_upload', input);
    await deny(admin, 'system_finish_upload', { ...input, actorId: otherManager.id, sessionId: otherManager.sessionId }, 'NOT_FOUND');
    await deny(admin, 'system_finish_upload', { ...input, sessionId: otherManager.sessionId }, 'UNAUTHENTICATED');
    await deny(admin, 'system_finish_upload', { ...input, sessionId: randomUUID() }, 'UNAUTHENTICATED');
  });

  it('אינו משחזר קובץ מחובר שהמעלה כבר אינו מורשה לקרוא', async () => {
    const input = await pending();
    await value(admin, 'system_finish_upload', input);
    await value(manager.client, 'create_document', { projectId: sharedProject.id, fileId: input.fileId, category: 'plans', access: { mode: 'owner' } });
    await deny(manager.client, 'authorize_file', { fileId: input.fileId, variant: 'original' }, 'NOT_FOUND');
    await deny(manager.client, 'get_pending_upload', { fileId: input.fileId }, 'NOT_FOUND');
    await deny(admin, 'system_finish_upload', input, 'NOT_FOUND');
  });

  it('בודק ביטול סשן גם בחזרה אחרי הצלחה', async () => {
    const person = await actor(admin, ben.client, 'retry-revoked', true);
    await membership(ben.client, person.id, sharedProject.id, 'manager');
    const input = await pending(person);
    await value(admin, 'system_finish_upload', input);
    await value(ben.client, 'revoke_user_sessions', { id: person.id });
    await deny(person.client, 'get_pending_upload', { fileId: input.fileId }, 'UNAUTHENTICATED');
    await deny(admin, 'system_finish_upload', input, 'UNAUTHENTICATED');
  });

  it('בודק שיוך ומצב פרויקט נוכחיים בחזרה אחרי הצלחה', async () => {
    const p = await project(ben.client, 'חזרה והרשאה');
    await membership(ben.client, manager.id, p.id, 'manager');
    const input = await pending(manager, p.id);
    await value(admin, 'system_finish_upload', input);
    await value(ben.client, 'set_project_status', { id: p.id, expectedRevision: p.revision, status: 'completed' });
    await deny(manager.client, 'get_pending_upload', { fileId: input.fileId }, 'PROJECT_READ_ONLY');
    await deny(admin, 'system_finish_upload', input, 'FORBIDDEN');
    await value(ben.client, 'set_project_status', { id: p.id, expectedRevision: p.revision + 1, status: 'active' });
    await value(ben.client, 'remove_membership', { projectId: p.id, userId: manager.id, expectedRevision: 1 });
    await deny(manager.client, 'get_pending_upload', { fileId: input.fileId }, 'NOT_FOUND');
    await deny(admin, 'system_finish_upload', input, 'FORBIDDEN');
  });

  it('שומר דחייה סופית ולא הופך אותה להשלמה מוצלחת בניסיון חוזר', async () => {
    const input = await pending();
    const rejected = { fileId: input.fileId, actorId: input.actorId, sessionId: input.sessionId, state: 'rejected' };
    const first = await value(admin, 'system_finish_upload', rejected);
    expect(await value(manager.client, 'get_pending_upload', { fileId: input.fileId })).toMatchObject({ state: 'rejected' });
    expect(await value(admin, 'system_finish_upload', rejected)).toEqual(first);
    await deny(admin, 'system_finish_upload', input, 'CONFLICT');
  });
});


async function orphan() {
  const email = `p12-retry-${randomUUID()}@example.invalid`;
  const password = randomBytes(32).toString('base64url');
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`יצירת Auth בדוי נכשלה: ${error?.code ?? 'missing_user'}`);
  return { id: data.user.id, email, password, input: { requestId: randomUUID(), email, fullName: 'משתמש בדוי לחזרה' } };
}

describe.sequential('יצירת פרופיל חוזרת עם JWT אמיתי', () => {
  it('משחזר יצירת פרופיל אחרי כשל סיסמה ומסמן השלמה בלי לאפס שוב', async () => {
    const person = await orphan();
    const [first, concurrent] = await Promise.all([
      value<Saved & { passwordPending: boolean }>(ben.client, 'create_profile', person.input),
      value<Saved & { passwordPending: boolean }>(ben.client, 'create_profile', person.input),
    ]);
    expect(concurrent).toEqual(first);
    expect(ProfileCreationResultSchema.parse(first)).toMatchObject({ id: person.id, passwordPending: true });
    // Simulate the boundary where setPassword failed: no Auth update occurred.
    expect(await value(ben.client, 'create_profile', person.input)).toEqual(first);
    const oldSession = await login(person.email, person.password);
    const changed = await admin.auth.admin.updateUserById(person.id, { password: randomBytes(32).toString('base64url') });
    if (changed.error) throw new Error(`עדכון סיסמה בדויה נכשל: ${changed.error.code}`);
    const completed = await value<Saved>(ben.client, 'complete_profile_creation', { requestId: person.input.requestId, userId: person.id });
    expect(await value(oldSession.client, 'get_actor')).toBeNull();
    const before = await ben.client.from('profiles').select('*').eq('id', person.id).single();
    expect(before.error).toBeNull();
    expect(await value(ben.client, 'complete_profile_creation', { requestId: person.input.requestId, userId: person.id })).toEqual(completed);
    expect(await value(ben.client, 'create_profile', person.input)).toMatchObject({ id: person.id, passwordPending: false });
    const after = await ben.client.from('profiles').select('*').eq('id', person.id).single();
    expect(after.error).toBeNull();
    expect(after.data).toEqual(before.data);
    const events = await ben.client.from('sensitive_events').select('id').eq('action', 'user.created').eq('entity_id', person.id);
    expect(events.error).toBeNull();
    expect(events.data).toHaveLength(1);
    await value(ben.client, 'update_profile', { id: person.id, expectedRevision: completed.revision, email: person.email, fullName: 'שם אחרי השלמה' });
    expect(await value(ben.client, 'create_profile', person.input)).toMatchObject({ id: person.id, passwordPending: false });
  });

  it('דוחה חשבון קיים, בקשה אחרת ותוכן סותר במקום להפוך אותם לאיפוס סיסמה', async () => {
    const person = await orphan();
    await value(ben.client, 'create_profile', person.input);
    await deny(ben.client, 'create_profile', { ...person.input, requestId: randomUUID() }, 'CONFLICT');
    await deny(ben.client, 'create_profile', { ...person.input, fullName: 'שם שונה' }, 'CONFLICT');
    const other = await orphan();
    await deny(ben.client, 'create_profile', { ...person.input, email: other.email }, 'CONFLICT');
    await deny(ben.client, 'complete_profile_creation', { requestId: person.input.requestId, userId: other.id }, 'CONFLICT');
    const profile = await ben.client.from('profiles').select('email').eq('id', manager.id).single();
    expect(profile.error).toBeNull();
    await deny(ben.client, 'create_profile', { ...person.input, requestId: randomUUID(), email: profile.data!.email }, 'CONFLICT');
  });

  it('דוחה חזרת pending אחרי שינוי פרופיל או ביטול סשן', async () => {
    const person = await orphan();
    const saved = await value<Saved>(ben.client, 'create_profile', person.input);
    await value(ben.client, 'update_profile', { id: person.id, expectedRevision: saved.revision, fullName: 'שם מעודכן', email: person.email });
    await deny(ben.client, 'create_profile', person.input, 'CONFLICT');
    await deny(ben.client, 'complete_profile_creation', { requestId: person.input.requestId, userId: person.id }, 'CONFLICT');
    const revoked = await orphan();
    await value(ben.client, 'create_profile', revoked.input);
    await value(ben.client, 'revoke_user_sessions', { id: revoked.id });
    await deny(ben.client, 'create_profile', revoked.input, 'CONFLICT');
  });

  it('מנהל ואורח אינם יכולים לחדש או להשלים בקשת בעלים', async () => {
    const person = await orphan();
    await value(ben.client, 'create_profile', person.input);
    for (const client of [manager.client, anonymous]) {
      await deny(client, 'create_profile', person.input);
      await deny(client, 'complete_profile_creation', { requestId: person.input.requestId, userId: person.id });
    }
    await deny(ben.client, 'create_profile', { email: person.input.email, fullName: person.input.fullName }, 'VALIDATION');
  });
});
