import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Json } from '../../src/types/database';
import { actor, clients, login, membership, owner, project, rpc, value, type Client, type TestActor } from './support/cloud';

// HIDE-TECH-ADMINS: a technical admin is not an assignee option; others still are. Fake data only (@example.invalid).
const made: string[] = [];
let admin: Client, anonymous: Client, ben: TestActor, member: TestActor, tech: TestActor, projectId: string;
const call = (client: Client, name: string, input: Json) => rpc(client, name as never, input);
const revision = async (id: string) => (await ben.client.from('profiles').select('revision').eq('id', id).single()).data!.revision;
const picker = async (client: Client, keep?: string[]) => {
  const { data, error } = await (client as unknown as { rpc: (n: string, a: object) => Promise<{ data: { user_id: string }[] | null; error: unknown }> }).rpc('list_project_assignees', keep ? { p: projectId, keep } : { p: projectId });
  expect(error).toBeNull();
  return (data ?? []).map(r => r.user_id);
};

beforeAll(async () => {
  ({ admin, anonymous } = clients()); ben = await owner(admin); member = await actor(admin, ben.client, 'tech-member');
  const email = `p12-tech-${randomUUID()}@example.invalid`, password = randomBytes(32).toString('base64url');
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error('createUser failed');
  made.push(data.user.id);
  await value(admin, 'system_add_owner' as never, { userId: data.user.id, fullName: 'אדמין טכני בדוי' });
  tech = await login(email, password);
  projectId = (await project(ben.client, 'tech-admin')).id;
  await membership(ben.client, member.id, projectId, 'worker');
}, 120_000);

afterAll(async () => {
  for (const id of made) {
    const row = (await ben.client.from('profiles').select('is_active,revision').eq('id', id).maybeSingle()).data;
    if (row?.is_active) await value(ben.client, 'set_user_active', { id, active: false, expectedRevision: row.revision });
  }
}, 60_000);

describe.sequential('מנהל טכני (HIDE-TECH-ADMINS)', () => {
  it('לפני הסימון: כל האדמינים, גם הטכני לעתיד, מופיעים בבחירה', async () => {
    const ids = await picker(ben.client);
    expect(ids).toEqual(expect.arrayContaining([ben.id, tech.id, member.id]));
  });
  it('רק אדמין מסמן; משתמש רגיל, אנונימי, יעד שאינו אדמין וגרסה ישנה נדחים', async () => {
    const input = (userId: string, rev: number) => ({ userId, enabled: true, expectedRevision: rev });
    expect((await call(member.client, 'set_technical_admin', input(tech.id, 1))).error?.message).toBe('FORBIDDEN');
    expect((await call(anonymous, 'set_technical_admin', input(tech.id, 1))).error).not.toBeNull();
    expect((await call(ben.client, 'set_technical_admin', input(member.id, await revision(member.id)))).error?.message).toBe('VALIDATION');
    expect((await call(ben.client, 'set_technical_admin', input(tech.id, (await revision(tech.id)) + 5))).error?.message).toBe('CONFLICT');
  });
  it('אחרי הסימון: הטכני לא חוזר מהפונקציה, בן וחבר הפרויקט כן', async () => {
    await value(ben.client, 'set_technical_admin' as never, { userId: tech.id, enabled: true, expectedRevision: await revision(tech.id) });
    for (const client of [ben.client, tech.client, member.client]) {
      const ids = await picker(client);
      expect(ids).not.toContain(tech.id);
      expect(ids).toEqual(expect.arrayContaining([ben.id, member.id]));
    }
    expect(await value(tech.client, 'get_actor')).toMatchObject({ isOwner: true }); // full owner rights stay
  });
  it('מי ששויך כבר למשימה חוזר דרך keep, ורק הוא', async () => {
    expect(await picker(ben.client, [tech.id])).toContain(tech.id);
    expect(await picker(ben.client, [member.id])).not.toContain(tech.id);
  });
  it('הסרת הסימון מחזירה לבחירה; האדמין יכול לסמן את עצמו', async () => {
    await value(tech.client, 'set_technical_admin' as never, { userId: tech.id, enabled: false, expectedRevision: await revision(tech.id) });
    expect(await picker(ben.client)).toContain(tech.id);
    const events = await ben.client.from('sensitive_events').select('id').eq('action', 'user.updated').eq('entity_id', tech.id);
    expect(events.data!.length).toBeGreaterThanOrEqual(2);
  });
});
