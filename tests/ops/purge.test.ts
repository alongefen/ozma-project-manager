import {readFileSync} from 'node:fs';
import {describe, expect, it, vi} from 'vitest';
import {PROJECT_REF} from '../../scripts/ops/lib.mjs';
import {PROTECTED, TABLES, enableTriggersSql, expectedTotal, run, summarize} from '../../scripts/ops/purge-demo.mjs';

const env = {SUPABASE_URL: `https://${PROJECT_REF}.supabase.co`, SUPABASE_SECRET_KEY: 's', SUPABASE_ACCESS_TOKEN: 't'};

function fake(rows = 3) {
  const state = {rows, files: [{bucket: 'b', path: 'p1'}, {bucket: 'b', path: 'p2'}], users: [{id: 'u1', email: 'a@example.invalid'}, {id: 'u2', email: 'owner@gmail.com'}], calls: [] as string[]};
  const sql = vi.fn(async (q: string) => {
    state.calls.push(q.startsWith('alter table') ? 'purge-sql' : q.slice(0, 20));
    if (q.startsWith('alter table')) { state.rows = 0; return []; }
    if (q.includes('union all')) return TABLES.map((t: string, i: number) => ({t, n: i === 0 ? state.rows : 0}));
    if (q.includes('storage.objects')) return state.files;
    return [{who: 'postgres', can_alter_triggers: true, triggers_not_enabled: 0}];
  });
  const admin = {
    auth: {admin: {listUsers: vi.fn(async () => ({data: {users: state.users}, error: null})), deleteUser: vi.fn(async (id: string) => { state.users = state.users.filter(u => u.id !== id); state.calls.push('auth'); return {error: null}; })}},
    storage: {from: vi.fn(() => ({remove: vi.fn(async () => { state.files = []; state.calls.push('storage'); return {error: null}; })}))},
  };
  return {state, sql, admin};
}

describe('purge-demo', () => {
  it('purge SQL covers exactly the app tables and nothing structural', () => {
    const sql = readFileSync('scripts/ops/purge-demo.sql', 'utf8');
    const deleted = [...sql.matchAll(/^delete from (\S+);/gm)].map(m => m[1]);
    expect([...deleted].sort()).toEqual([...TABLES].sort());
    expect(sql).not.toMatch(/drop |truncate |create /i);
    const alters = [...sql.matchAll(/^alter table (\S+) (disable|enable) trigger (immutable_\w+);/gm)];
    expect(alters).toHaveLength(14); // 7 off, 7 on, nothing else altered
    expect(sql.match(/^alter /gm)).toHaveLength(14);
    expect(sql).not.toMatch(/where/i); // all-or-nothing by design
  });
  it('purge SQL is one transaction: disables first, deletes, enables last; lists match', () => {
    const sql = readFileSync('scripts/ops/purge-demo.sql', 'utf8');
    const at = (re: RegExp) => sql.search(re);
    expect(sql).toMatch(/^begin;/m); expect(sql).toMatch(/^commit;\s*$/m);
    expect(at(/disable trigger/)).toBeLessThan(at(/^delete from/m));
    expect(sql.lastIndexOf('delete from')).toBeLessThan(sql.indexOf('enable trigger'));
    for (const [t, g] of PROTECTED) { expect(sql).toContain(`alter table public.${t} disable trigger ${g};`); expect(sql).toContain(`alter table public.${t} enable trigger ${g};`); }
  });
  it('refuses a real run when the role cannot manage triggers or triggers are already off', async () => {
    for (const bad of [{can_alter_triggers: false, triggers_not_enabled: 0}, {can_alter_triggers: true, triggers_not_enabled: 2}]) {
      const f = fake(); const base = f.sql.getMockImplementation()!;
      f.sql.mockImplementation(async (q: string) => q.includes('pg_trigger') ? [{who: 'postgres', ...bad}] : base(q));
      const total = expectedTotal(summarize({counts: {a: 3}, files: f.state.files, users: f.state.users}));
      await expect(run({args: {confirm: true, 'project-ref': PROJECT_REF, 'expect-total': String(total), 'include-real-users': true}, env, log: vi.fn(), sqlText: 'alter table x;', clients: {admin: f.admin, sql: f.sql}})).rejects.toThrow(/Refusing: the SQL role/);
      expect(f.state.calls).not.toContain('purge-sql');
    }
  });
  it('re-enables triggers when the purge SQL fails', async () => {
    const f = fake(); const base = f.sql.getMockImplementation()!; const seen: string[] = [];
    f.sql.mockImplementation(async (q: string) => { seen.push(q.slice(0, 18)); if (q === 'FAIL;') throw new Error('boom'); return base(q); });
    const total = expectedTotal(summarize({counts: {a: 3}, files: f.state.files, users: f.state.users}));
    await expect(run({args: {confirm: true, 'project-ref': PROJECT_REF, 'expect-total': String(total), 'include-real-users': true}, env, log: vi.fn(), sqlText: 'FAIL;', clients: {admin: f.admin, sql: f.sql}})).rejects.toThrow(/re-enabled/);
    expect(seen).toContain(enableTriggersSql().slice(0, 18));
    expect(f.admin.auth.admin.deleteUser).not.toHaveBeenCalled();
  });
  it('dry run writes nothing and shows counts', async () => {
    const f = fake(); const log = vi.fn();
    const r = await run({args: {}, env, log, sqlText: 'alter table x;', clients: {admin: f.admin, sql: f.sql}});
    expect(r.wrote).toBe(false);
    expect(f.state.calls).not.toContain('purge-sql');
    expect(f.admin.auth.admin.deleteUser).not.toHaveBeenCalled();
    expect(log.mock.calls[0][0]).toContain('DRY RUN');
    expect(log.mock.calls[0][0]).not.toContain('owner@gmail.com'); // non-demo accounts are masked
  });
  it('real run needs confirm, ref and the matching expected total', async () => {
    const f = fake();
    await expect(run({args: {confirm: true}, env, log: vi.fn(), clients: {admin: f.admin, sql: f.sql}})).rejects.toThrow(/project-ref/);
    await expect(run({args: {confirm: true, 'project-ref': PROJECT_REF, 'include-real-users': true}, env, log: vi.fn(), sqlText: 'alter table x;', clients: {admin: f.admin, sql: f.sql}})).rejects.toThrow(/expect-total/);
    await expect(run({args: {confirm: true, 'project-ref': PROJECT_REF, 'expect-total': '1', 'include-real-users': true}, env, log: vi.fn(), sqlText: 'alter table x;', clients: {admin: f.admin, sql: f.sql}})).rejects.toThrow(/expect-total/);
    expect(f.state.calls).not.toContain('purge-sql');
  });
  it('real run: storage, then SQL, then auth users, then verifies empty', async () => {
    const f = fake();
    const total = expectedTotal(summarize({counts: {a: 3}, files: f.state.files, users: f.state.users}));
    const r = await run({args: {confirm: true, 'project-ref': PROJECT_REF, 'expect-total': String(total), 'include-real-users': true}, env, log: vi.fn(), sqlText: 'alter table x;', clients: {admin: f.admin, sql: f.sql}});
    expect(r.wrote).toBe(true);
    const order = f.state.calls.filter(c => ['storage', 'purge-sql', 'auth'].includes(c));
    expect(order[0]).toBe('storage'); expect(order[1]).toBe('purge-sql'); expect(order[2]).toBe('auth');
    expect(f.state.users).toHaveLength(0);
  });
  it('refuses when non-demo logins exist unless overridden', async () => {
    const f = fake();
    const total = expectedTotal(summarize({counts: {a: 3}, files: f.state.files, users: f.state.users}));
    const base = {confirm: true, 'project-ref': PROJECT_REF, 'expect-total': String(total)};
    await expect(run({args: base, env, log: vi.fn(), sqlText: 'alter table x;', clients: {admin: f.admin, sql: f.sql}})).rejects.toThrow(/non-demo/);
    expect(f.state.calls).not.toContain('purge-sql');
  });
  it('summary separates demo accounts from others', () => {
    const s = summarize({counts: {a: 1}, files: [], users: [{email: 'x@example.invalid'}, {email: 'real@gmail.com'}]});
    expect(s.demoUsers).toBe(1); expect(s.otherUsers).toEqual(['r***@gmail.com']);
  });
});
