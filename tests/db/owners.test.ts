import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Json } from '../../src/types/database';
import { actor, clients, login, owner, rpc, value, type Client, type TestActor } from './support/cloud';

// OWNERS-MIGRATION: several owner-level accounts. Fake data only (@example.invalid); every account made here is ours.
const made: string[] = [];
let admin: Client, anonymous: Client, ben: TestActor, user: TestActor;
const call = (client: Client, name: string, input: Json) => rpc(client, name as never, input);
async function deny(client: Client, name: string, input: Json, code: string) {
  const result = await call(client, name, input);
  expect(result.error, `${name} should reject`).not.toBeNull();
  expect(result.error?.message).toBe(code);
}
async function newOwner(label: string): Promise<TestActor> {
  const email = `p12-${label}-${randomUUID()}@example.invalid`, password = randomBytes(32).toString('base64url');
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error('createUser failed');
  made.push(data.user.id);
  await value(admin, 'system_add_owner' as never, { userId: data.user.id, fullName: `אדמין בדיקה ${label}` });
  return login(email, password);
}
const revision = async (id: string) => (await admin.from('profiles').select('revision').eq('id', id).single()).data!.revision;

beforeAll(async () => {
  ({ admin, anonymous } = clients()); ben = await owner(admin); user = await actor(admin, ben.client, 'plain');
}, 120_000);

// Leave no owner-level account behind: deactivating also removes the owner level.
afterAll(async () => {
  for (const id of made) {
    const row = (await admin.from('profiles').select('is_owner,is_active,revision').eq('id', id).maybeSingle()).data;
    if (row?.is_active) await value(ben.client, 'set_user_active', { id, active: false, expectedRevision: row.revision });
  }
}, 60_000);

describe.sequential('כמה בעלים (OWNERS-MIGRATION)', () => {
  it('system_add_owner: שירות בלבד, אידמפוטנטי, ובעלים חדש פועל כבעלים', async () => {
    const email = `p12-add-${randomUUID()}@example.invalid`;
    const created = await admin.auth.admin.createUser({ email, password: randomBytes(32).toString('base64url'), email_confirm: true });
    const id = created.data.user!.id; made.push(id); const input = { userId: id, fullName: 'אדמין בדיקה' };
    for (const client of [anonymous, ben.client, user.client]) expect((await call(client, 'system_add_owner', input)).error).not.toBeNull();
    const first = await value<{ id: string; revision: number }>(admin, 'system_add_owner' as never, input);
    const second = await value<{ id: string; revision: number }>(admin, 'system_add_owner' as never, input);
    expect(second).toEqual(first);
    const events = await admin.from('sensitive_events').select('id').eq('action', 'owner.created').eq('entity_id', id);
    expect(events.data).toHaveLength(1);
    await deny(admin, 'system_add_owner', { userId: randomUUID(), fullName: 'x' }, 'NOT_FOUND');
    await deny(admin, 'system_bootstrap_owner', input, 'CONFLICT');
  });
  it('בעלים שני רואה ופועל כבעלים, משתמש רגיל לא יכול לקדם ולא להשבית', async () => {
    const second = await newOwner('second');
    expect(await value(second.client, 'get_actor')).toMatchObject({ isOwner: true });
    expect((await second.client.from('profiles').select('id')).data!.length).toBeGreaterThan(1);
    await deny(user.client, 'set_owner_level', { userId: user.id, enabled: true, expectedRevision: await revision(user.id) }, 'FORBIDDEN');
    await deny(user.client, 'set_user_active', { id: second.id, active: false, expectedRevision: await revision(second.id) }, 'FORBIDDEN');
    await deny(anonymous, 'set_owner_level', { userId: user.id, enabled: true, expectedRevision: 1 }, 'permission denied for function set_owner_level');
  });
  it('קידום והורדה ידניים, גרסה ישנה נדחית, אי אפשר להוריד את עצמך', async () => {
    const peer = await actor(admin, ben.client, 'promote');
    const rev = await revision(peer.id);
    await deny(ben.client, 'set_owner_level', { userId: peer.id, enabled: true, expectedRevision: rev + 3 }, 'CONFLICT');
    await value(ben.client, 'set_owner_level' as never, { userId: peer.id, enabled: true, expectedRevision: rev });
    expect(await value(peer.client, 'get_actor')).toMatchObject({ isOwner: true });
    await deny(peer.client, 'set_owner_level', { userId: peer.id, enabled: false, expectedRevision: await revision(peer.id) }, 'FORBIDDEN');
    await value(peer.client, 'set_owner_level' as never, { userId: ben.id, enabled: true, expectedRevision: await revision(ben.id) }); // already owner: no-op
    await value(ben.client, 'set_owner_level' as never, { userId: peer.id, enabled: false, expectedRevision: await revision(peer.id) });
    const demoted = await admin.from('sensitive_events').select('id').eq('action', 'owner.demoted').eq('entity_id', peer.id);
    expect(demoted.data).toHaveLength(1);
    await deny(peer.client, 'create_profile', { requestId: randomUUID(), email: 'x@example.invalid', fullName: 'x' }, 'FORBIDDEN');
  });
  it('בעלים משבית בעלים אחר: הסשן נעצר והרמה יורדת; לא את עצמך', async () => {
    const victim = await newOwner('victim');
    await deny(ben.client, 'set_user_active', { id: ben.id, active: false, expectedRevision: await revision(ben.id) }, 'FORBIDDEN');
    await value(ben.client, 'set_user_active', { id: victim.id, active: false, expectedRevision: await revision(victim.id) });
    expect(await value(victim.client, 'get_actor')).toBeNull();
    const row = (await admin.from('profiles').select('is_active,is_owner').eq('id', victim.id).single()).data!;
    expect(row).toEqual({ is_active: false, is_owner: false });
    await value(ben.client, 'revoke_user_sessions', { id: (await newOwner('reset')).id }); // password-reset path accepts an owner target
  });
  it('system_owner_recovered פועל על בעלים אחד בלבד', async () => {
    const other = await newOwner('recover');
    await deny(admin, 'system_owner_recovered', { supportId: 'p12-test' }, 'VALIDATION');
    await deny(admin, 'system_owner_recovered', { supportId: 'p12-test', userId: user.id }, 'NOT_FOUND');
    await value(admin, 'system_owner_recovered' as never, { supportId: 'p12-test', userId: other.id });
    expect(await value(other.client, 'get_actor')).toBeNull();
    expect(await value(ben.client, 'get_actor')).toMatchObject({ isOwner: true });
    for (const client of [anonymous, ben.client, user.client]) expect((await call(client, 'system_owner_recovered', { supportId: 'x', userId: other.id })).error).not.toBeNull();
  });
});
