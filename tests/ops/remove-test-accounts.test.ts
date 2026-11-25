import {describe, expect, it, vi} from 'vitest';
import {PROJECT_REF} from '../../scripts/ops/lib.mjs';
import {foreignSql, removalSql, run, selectSql} from '../../scripts/ops/remove-test-accounts.mjs';

const env = {SUPABASE_URL: `https://${PROJECT_REF}.supabase.co`, SUPABASE_SECRET_KEY: 's', SUPABASE_ACCESS_TOKEN: 't'};
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const selected = [{kind: 'profile', id: id(1), email: 'a@example.invalid'}, {kind: 'profile', id: id(2), email: 'b@example.invalid'}, {kind: 'auth-only', id: id(3), email: 'p12-owner-x@example.invalid'}];

function fake({foreign = [] as { t: string; n: number }[], left = false} = {}) {
  const state = {calls: [] as string[], removed: false};
  const sql = vi.fn(async (q: string) => {
    if (q.startsWith('begin;')) { state.calls.push('removal'); state.removed = true; return []; }
    if (q.includes("'profile' as kind")) return state.removed && !left ? [] : selected;
    if (q.includes('log rows of another kind')) return foreign;
    if (q.includes('pg_trigger')) return [{who: 'postgres', can_alter_triggers: true, triggers_not_enabled: 0}];
    if (q.includes('public.profiles')) return [{t: 'public.profiles', n: state.removed ? 0 : 2}, {t: 'public.sensitive_events', n: state.removed ? 0 : 5}];
    return [];
  });
  const admin = {auth: {admin: {getUserById: vi.fn(async (i: string) => ({data: {user: {id: i, email: 'x@example.invalid'}}, error: null})), deleteUser: vi.fn(async () => { state.calls.push('auth'); return {error: null}; })}}};
  return {state, sql, admin};
}
const real = {confirm: true, 'project-ref': PROJECT_REF, 'expect-total': '10', 'expect-accounts': '3'};

describe('remove-test-accounts', () => {
  it('the selection is a narrow rule: test day, inactive, not owner, exact names, never demo', () => {
    const q = selectSql();
    expect(q).toContain("not is_active and not is_owner"); expect(q).toContain("2026-11-25"); expect(q).toContain("not like '%(דמו)%'");
    expect(q).toContain("like '%@example.invalid'");
  });
  it('the removal switches off only the sensitive_events trigger, inside one transaction, and back on', () => {
    const sql = removalSql(selected);
    expect(sql.match(/^alter table/gm)).toHaveLength(2);
    expect(sql).toMatch(/disable trigger immutable_sensitive_events/); expect(sql).toMatch(/enable trigger immutable_sensitive_events/);
    expect(sql.indexOf('disable trigger')).toBeLessThan(sql.indexOf('delete from public.sensitive_events'));
    expect(sql.indexOf('delete from public.sensitive_events')).toBeLessThan(sql.indexOf('enable trigger'));
    expect(sql.startsWith('begin;')).toBe(true); expect(sql.trimEnd().endsWith('commit;')).toBe(true);
    for (const row of sql.split('\n').filter(l => l.startsWith('delete'))) expect(row).toContain('any(array[');
    expect(sql).not.toMatch(/delete from public\.(projects|memberships|stored_files|diary|transactions|documents|tasks)/);
  });
  it('refuses a non-uuid id', () => { expect(() => removalSql([{kind: 'profile', id: "x'; drop table a;--", email: 'a'}])).toThrow(/not a uuid/); });
  it('foreign checks cover every table that can point at a profile', () => {
    const q = foreignSql(selected);
    for (const t of ['memberships', 'projects', 'stored_files', 'documents', 'diary_entries', 'diary_versions', 'tasks', 'transactions', 'project_covers']) expect(q).toContain(`public.${t}`);
  });
  it('dry run changes nothing and masks emails and ids', async () => {
    const f = fake(); const log = vi.fn();
    const r = await run({args: {}, env, log, clients: {admin: f.admin, sql: f.sql}});
    expect(r.wrote).toBe(false); expect(f.state.calls).toEqual([]);
    const out = log.mock.calls.map(c => c[0]).join('\n');
    expect(out).not.toContain('a@example.invalid'); expect(out).not.toContain(id(1));
  });
  it('real run needs the typed project ref, the account count and the dry-run total', async () => {
    const f = fake();
    await expect(run({args: {confirm: true}, env, log: vi.fn(), clients: {admin: f.admin, sql: f.sql}})).rejects.toThrow(/project-ref/);
    await expect(run({args: {...real, 'expect-accounts': '2'}, env, log: vi.fn(), clients: {admin: f.admin, sql: f.sql}})).rejects.toThrow(/expect-accounts/);
    await expect(run({args: {...real, 'expect-total': '1'}, env, log: vi.fn(), clients: {admin: f.admin, sql: f.sql}})).rejects.toThrow(/expect-total/);
    expect(f.state.calls).toEqual([]);
  });
  it('refuses when anything else points at the accounts', async () => {
    const f = fake({foreign: [{t: 'memberships', n: 1}]});
    await expect(run({args: real, env, log: vi.fn(), clients: {admin: f.admin, sql: f.sql}})).rejects.toThrow(/still points/);
    expect(f.state.calls).toEqual([]);
  });
  it('removes rows first, then logins, and verifies', async () => {
    const f = fake();
    expect((await run({args: real, env, log: vi.fn(), clients: {admin: f.admin, sql: f.sql}})).wrote).toBe(true);
    expect(f.state.calls).toEqual(['removal', 'auth', 'auth', 'auth']);
  });
  it('re-enables triggers and stops when the SQL fails; no logins are deleted', async () => {
    const f = fake(); const base = f.sql.getMockImplementation()!;
    f.sql.mockImplementation(async (q: string) => { if (q.startsWith('begin;')) throw new Error('boom'); return base(q); });
    await expect(run({args: real, env, log: vi.fn(), clients: {admin: f.admin, sql: f.sql}})).rejects.toThrow(/re-enabled/);
    expect(f.admin.auth.admin.deleteUser).not.toHaveBeenCalled();
    expect(f.sql.mock.calls.some(c => String(c[0]).includes('enable trigger'))).toBe(true);
  });
});
