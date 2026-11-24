import {describe, expect, it, vi} from 'vitest';
import {PROJECT_REF} from '../../scripts/ops/lib.mjs';
import {seed, validate} from '../../scripts/ops/seed-accounts.mjs';

const env = {SUPABASE_URL: `https://${PROJECT_REF}.supabase.co`, SUPABASE_PUBLISHABLE_KEY: 'p', SUPABASE_SECRET_KEY: 's'};
const args = {'owner-email': 'Ben@Fake.test', 'owner-name': 'Ben Fake', 'developer-email': 'dev@fake.test'};

function clients() {
  const rpcs: string[] = [];
  const admin = {auth: {admin: {createUser: vi.fn(async ({email}: {email: string}) => ({data: {user: {id: `id-${email}`}}, error: null}))}}, rpc: vi.fn(async (name: string) => { rpcs.push(name); return {data: {}, error: null}; })};
  const pub = {auth: {signInWithPassword: vi.fn(async () => ({data: {}, error: null}))}, rpc: vi.fn(async (name: string) => { rpcs.push(name); return {data: {}, error: null}; })};
  return {admin, pub, rpcs};
}

describe('seed-accounts', () => {
  it('validates emails and rejects the demo domain', () => {
    expect(validate(args).ownerEmail).toBe('ben@fake.test');
    expect(() => validate({...args, 'developer-email': 'ben@fake.test'})).toThrow();
    expect(() => validate({...args, 'owner-email': 'a@example.invalid'})).toThrow();
    expect(() => validate({...args, 'owner-name': ''})).toThrow();
  });
  it('dry run touches nothing', async () => {
    const c = clients();
    const r = await seed({args, env, log: vi.fn(), print: vi.fn(), clients: c});
    expect(r.wrote).toBe(false); expect(c.admin.auth.admin.createUser).not.toHaveBeenCalled();
  });
  it('real run: owner via bootstrap, developer via system_add_owner, passwords printed once and not logged', async () => {
    const c = clients(); const log = vi.fn(); const print = vi.fn();
    await seed({args: {...args, confirm: true, 'project-ref': PROJECT_REF}, env, log, print, clients: c});
    expect(c.rpcs).toEqual(['system_bootstrap_owner', 'system_add_owner']);
    const printed = print.mock.calls.map(x => x[0]).join('\n');
    expect(printed).toMatch(/owner ben@fake.test\s+\S{24}/);
    expect(log.mock.calls.join('\n')).not.toMatch(/\S{24}/);
  });
});
