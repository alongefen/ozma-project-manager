import {readFileSync} from 'node:fs';
import {describe, expect, it, vi} from 'vitest';
import {PROJECT_REF} from '../../scripts/ops/lib.mjs';
import {TABLES, expectedTotal, run, summarize} from '../../scripts/ops/purge-demo.mjs';

const env = {SUPABASE_URL: `https://${PROJECT_REF}.supabase.co`, SUPABASE_SECRET_KEY: 's', SUPABASE_ACCESS_TOKEN: 't'};

function fake(rows = 3) {
  const state = {rows, files: [{bucket: 'b', path: 'p1'}, {bucket: 'b', path: 'p2'}], users: [{id: 'u1', email: 'a@example.invalid'}, {id: 'u2', email: 'owner@gmail.com'}], calls: [] as string[]};
  const sql = vi.fn(async (q: string) => {
    state.calls.push(q.startsWith('set local') ? 'purge-sql' : q.slice(0, 20));
    if (q.startsWith('set local')) { state.rows = 0; return []; }
    if (q.includes('union all')) return TABLES.map((t: string, i: number) => ({t, n: i === 0 ? state.rows : 0}));
    if (q.includes('storage.objects')) return state.files;
    return [{who: 'postgres', can_replica: true}];
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
    expect(sql).not.toMatch(/drop |truncate |alter |create /i);
    expect(sql).not.toMatch(/where/i); // all-or-nothing by design
  });
  it('dry run writes nothing and shows counts', async () => {
    const f = fake(); const log = vi.fn();
    const r = await run({args: {}, env, log, sqlText: 'set local x;', clients: {admin: f.admin, sql: f.sql}});
    expect(r.wrote).toBe(false);
    expect(f.state.calls).not.toContain('purge-sql');
    expect(f.admin.auth.admin.deleteUser).not.toHaveBeenCalled();
    expect(log.mock.calls[0][0]).toContain('DRY RUN');
    expect(log.mock.calls[0][0]).not.toContain('owner@gmail.com'); // non-demo accounts are masked
  });
  it('real run needs confirm, ref and the matching expected total', async () => {
    const f = fake();
    await expect(run({args: {confirm: true}, env, log: vi.fn(), clients: {admin: f.admin, sql: f.sql}})).rejects.toThrow(/project-ref/);
    await expect(run({args: {confirm: true, 'project-ref': PROJECT_REF}, env, log: vi.fn(), sqlText: 'set local x;', clients: {admin: f.admin, sql: f.sql}})).rejects.toThrow(/expect-total/);
    await expect(run({args: {confirm: true, 'project-ref': PROJECT_REF, 'expect-total': '1'}, env, log: vi.fn(), sqlText: 'set local x;', clients: {admin: f.admin, sql: f.sql}})).rejects.toThrow(/expect-total/);
    expect(f.state.calls).not.toContain('purge-sql');
  });
  it('real run: storage, then SQL, then auth users, then verifies empty', async () => {
    const f = fake();
    const total = expectedTotal(summarize({counts: {a: 3}, files: f.state.files, users: f.state.users}));
    const r = await run({args: {confirm: true, 'project-ref': PROJECT_REF, 'expect-total': String(total)}, env, log: vi.fn(), sqlText: 'set local session_replication_role = replica;', clients: {admin: f.admin, sql: f.sql}});
    expect(r.wrote).toBe(true);
    const order = f.state.calls.filter(c => ['storage', 'purge-sql', 'auth'].includes(c));
    expect(order[0]).toBe('storage'); expect(order[1]).toBe('purge-sql'); expect(order[2]).toBe('auth');
    expect(f.state.users).toHaveLength(0);
  });
  it('summary separates demo accounts from others', () => {
    const s = summarize({counts: {a: 1}, files: [], users: [{email: 'x@example.invalid'}, {email: 'real@gmail.com'}]});
    expect(s.demoUsers).toBe(1); expect(s.otherUsers).toEqual(['r***@gmail.com']);
  });
});
