/* eslint-disable @typescript-eslint/no-explicit-any */
import {describe, expect, it, vi} from 'vitest';
import {PROJECT_REF} from '../../scripts/ops/lib.mjs';
import {PROTECTED} from '../../scripts/ops/purge-demo.mjs';
import {adoptExtras, checkStoragePaths, removeAuthUsers, foreignSql, presentSql, removalSql, run} from '../../scripts/demo/remove-demo.mjs';
import {archiveLedger, emptyLedger, loadLedger, record, saveLedger} from '../../scripts/demo/ledger.mjs';
import {makeFile} from '../../scripts/demo/assets.mjs';

const env = {SUPABASE_URL: `https://${PROJECT_REF}.supabase.co`, SUPABASE_SECRET_KEY: 's', SUPABASE_ACCESS_TOKEN: 't'};
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function ledger() {
  const l = emptyLedger(PROJECT_REF);
  record(l, 'projects', {id: U(1), name: 'דוגמה: x'}); record(l, 'profiles', {id: U(2), email: 'a@example.invalid'});
  record(l, 'authUsers', {id: U(2), email: 'a@example.invalid'}); record(l, 'diaryEntries', {id: U(3)}); record(l, 'documents', {id: U(4)});
  record(l, 'tasks', {id: U(5)}); record(l, 'transactions', {id: U(6)}); record(l, 'storedFiles', {id: U(7), projectId: U(1), bucket: 'originals', path: 'p'});
  record(l, 'storage', {bucket: 'originals', path: `${U(1)}/p`});
  return l;
}
function fake(opts: {foreign?: number; rows?: number; privilege?: any; failRemoval?: boolean} = {}) {
  const st = {rows: opts.rows ?? 2, projects: 40, calls: [] as string[], removed: [] as string[]};
  const sql = vi.fn(async (q: string) => {
    if (q.startsWith('begin;')) { st.calls.push('removal'); if (opts.failRemoval) throw new Error('db down'); st.rows = 0; st.projects = 39; return []; }
    if (q.startsWith('alter table')) { st.calls.push('re-enable'); return []; }
    if (q === 'select count(*)::int as n from public.projects') return [{n: st.projects}];
    if (q.includes("'diary_entries in a demo project'")) return [{t: 'tasks', n: opts.foreign ?? 0}];
    if (q.includes('as t, count(*)')) return [{t: 'public.projects', n: st.rows > 0 ? 1 : 0}, {t: 'x', n: Math.max(0, st.rows - 1)}];
    return [{who: 'postgres', can_alter_triggers: true, triggers_not_enabled: 0, ...(opts.privilege ?? {})}];
  });
  const admin = {auth: {admin: {getUserById: vi.fn(async () => ({data: {user: {email: 'a@example.invalid'}}, error: null})), deleteUser: vi.fn(async () => { st.calls.push('auth'); return {error: null}; })}},
    storage: {from: vi.fn(() => ({remove: vi.fn(async (p: string[]) => { st.removed.push(...p); st.calls.push('storage'); return {error: null}; })}))}};
  return {st, sql, admin};
}
const real = (total: number) => ({confirm: true, 'project-ref': PROJECT_REF, 'expect-total': String(total)});
const io = (l: any) => ({load: () => l, archive: vi.fn()});

describe('remove-demo SQL', () => {
  it('only touches ledger ids; one transaction; triggers off first and on last; never truncates', () => {
    const sql = removalSql(ledger());
    expect(sql).toMatch(/^begin;/); expect(sql).toMatch(/commit;$/);
    expect(sql).not.toMatch(/truncate|drop |create /i);
    for (const line of sql.split('\n').filter(l => l.startsWith('delete from'))) expect(line).toMatch(/any\(array\[/); // every delete is scoped
    expect(sql.indexOf('disable trigger')).toBeLessThan(sql.indexOf('delete from'));
    expect(sql.lastIndexOf('delete from')).toBeLessThan(sql.indexOf('enable trigger'));
    for (const [t, g] of PROTECTED) { expect(sql).toContain(`alter table public.${t} disable trigger ${g};`); expect(sql).toContain(`alter table public.${t} enable trigger ${g};`); }
    expect(sql).toContain(`'${U(1)}'`);
  });
  it('an empty list means "match nothing", never "match everything"', () => {
    const l = emptyLedger(PROJECT_REF); l.projects.push({id: U(1)} as never);
    const sql = removalSql(l);
    expect(sql).toContain('any(array[]::uuid[])');
    expect(sql).not.toMatch(/delete from \S+;/);
  });
  it('rejects a ledger value that is not a uuid (no SQL injection from a edited ledger)', () => {
    const l = ledger(); l.projects.push({id: "x'); drop table public.projects; --"} as never);
    expect(() => removalSql(l)).toThrow(/not a uuid/); expect(() => presentSql(l)).toThrow(); expect(() => foreignSql(l)).toThrow();
  });
});

describe('remove-demo run', () => {
  it('dry run: counts only, nothing written', async () => {
    const f = fake(); const l = ledger();
    const r = await run({args: {}, env, log: vi.fn(), clients: f as any, ledgerIO: io(l)});
    expect(r.wrote).toBe(false); expect(f.st.calls).toEqual([]);
  });
  it('refuses an empty ledger, a missing --expect-total, and a wrong one', async () => {
    await expect(run({args: {}, env, log: vi.fn(), clients: fake() as any, ledgerIO: io(emptyLedger(PROJECT_REF))})).rejects.toThrow(/ledger is empty/);
    const f = fake();
    await expect(run({args: {confirm: true, 'project-ref': PROJECT_REF}, env, log: vi.fn(), clients: f as any, ledgerIO: io(ledger())})).rejects.toThrow(/expect-total/);
    await expect(run({args: real(1), env, log: vi.fn(), clients: f as any, ledgerIO: io(ledger())})).rejects.toThrow(/expect-total/);
    expect(f.st.calls).toEqual([]);
  });
  it('refuses when a real person added rows to a demo project', async () => {
    const f = fake({foreign: 2});
    await expect(run({args: real(4), env, log: vi.fn(), clients: f as any, ledgerIO: io(ledger())})).rejects.toThrow(/did not create/);
    expect(f.st.calls).toEqual([]);
  });
  it('refuses when the SQL role cannot manage the triggers or one is already off', async () => {
    for (const privilege of [{can_alter_triggers: false}, {triggers_not_enabled: 1}]) {
      const f = fake({privilege});
      await expect(run({args: real(4), env, log: vi.fn(), clients: f as any, ledgerIO: io(ledger())})).rejects.toThrow(/Refusing: the SQL role/);
      expect(f.st.calls).toEqual([]);
    }
  });
  it('real run: removes ledger files, rows, then logins, verifies, archives the ledger; real projects untouched', async () => {
    const f = fake(); const l = ledger(); const i = io(l); const log = vi.fn();
    const total = 2 + 1 + 1; // rows + storage + logins
    const r = await run({args: real(total), env, log, clients: f as any, ledgerIO: i});
    expect(r.wrote).toBe(true); expect(f.st.calls).toEqual(['storage', 'removal', 'auth']);
    expect(f.st.removed).toEqual([`${U(1)}/p`]); expect(r).toMatchObject({projectsBefore: 40, projectsAfter: 39});
    expect(i.archive).toHaveBeenCalledWith(expect.objectContaining({removedAt: expect.any(String)}));
  });
  it('on a failed removal the triggers are switched back on and logins/ledger stay', async () => {
    const f = fake({failRemoval: true}); const i = io(ledger());
    await expect(run({args: real(4), env, log: vi.fn(), clients: f as any, ledgerIO: i})).rejects.toThrow(/triggers were re-enabled/);
    expect(f.st.calls).toEqual(['storage', 'removal', 're-enable']); expect(f.admin.auth.admin.deleteUser).not.toHaveBeenCalled(); expect(i.archive).not.toHaveBeenCalled();
  });
  it('refuses to delete a login that is not a demo account', async () => {
    const f = fake(); f.admin.auth.admin.getUserById.mockResolvedValue({data: {user: {email: 'ben@real.test'}}, error: null} as any);
    await expect(run({args: real(4), env, log: vi.fn(), clients: f as any, ledgerIO: io(ledger())})).rejects.toThrow(/not a demo account/);
    expect(f.admin.auth.admin.deleteUser).not.toHaveBeenCalled();
  });
  it('is idempotent: a second run on an already clean database passes with zero rows', async () => {
    const f = fake({rows: 0}); f.admin.auth.admin.getUserById.mockResolvedValue({data: {user: null}, error: {message: 'gone'}} as any);
    f.st.projects = 39; const l = ledger();
    const r = await run({args: real(2), env, log: vi.fn(), clients: f as any, ledgerIO: io(l)});
    expect(r.wrote).toBe(true);
  });
});

describe('poisoned ledger', () => {
  it('foreign check also flags listed ids that are not inside a demo project', () => {
    const sql = foreignSql(ledger());
    for (const t of ['entries', 'documents', 'tasks', 'transactions', 'files']) expect(sql).toContain(`listed ${t} outside the demo projects`);
    expect(sql).toMatch(/id = any\(array\['[^']+'\]::uuid\[\]\) and project_id <> all/);
  });
  it('a run with a listed id outside the demo projects is refused before anything changes', async () => {
    const f = fake({foreign: 1});
    await expect(run({args: real(4), env, log: vi.fn(), clients: f as any, ledgerIO: io(ledger())})).rejects.toThrow(/did not create/);
    expect(f.st.calls).toEqual([]);
  });
  it('refuses storage paths outside the demo projects or in another bucket', () => {
    const bad = ledger(); bad.storage = [{bucket: 'originals', path: 'p'}]; expect(() => checkStoragePaths(bad)).toThrow(/not under a demo project/);
    const ok = ledger(); ok.storage = [{bucket: 'originals', path: `${U(1)}/f1`}, {bucket: 'display', path: `${U(1)}/f1.jpg`}]; expect(() => checkStoragePaths(ok)).not.toThrow();
    ok.storage.push({bucket: 'originals', path: `${U(9)}/real`}); expect(() => checkStoragePaths(ok)).toThrow();
    ok.storage = [{bucket: 'covers', path: `${U(1)}/x`}]; expect(() => checkStoragePaths(ok)).toThrow();
  });
  it('archiving moves the live ledger aside', () => {
    const ops: string[] = []; const fs = {mkdir: () => {}, write: (p: string) => ops.push(`write ${p}`), rename: (a: string, b: string) => ops.push(`rename ${a}>${b}`), unlink: (p: string) => ops.push(`unlink ${p}`)};
    archiveLedger(emptyLedger(PROJECT_REF), 'x/l.json', fs as any);
    expect(ops).toEqual(['write x/l.json.removed.json.tmp', 'rename x/l.json.removed.json.tmp>x/l.json.removed.json', 'unlink x/l.json']);
  });
});

describe('adopting what people added during the meeting', () => {
  const sqlFor = (extra: any[] = [], found: any[] = []): any => vi.fn(async (q: string) => {
    if (q.includes('from public.stored_files')) return [{id: U(20), project_id: U(1), bucket: 'originals', object_path: `${U(1)}/${U(20)}`, display_path: `${U(1)}/${U(20)}.jpg`}];
    if (q.includes('from public.profiles')) return found;
    if (q.includes('from public.tasks')) return [{id: U(21)}];
    return extra;
  });
  it('adds only rows inside the demo projects, with their storage paths', async () => {
    const l = ledger(); const sql = sqlFor();
    const added = await adoptExtras({sql, ledger: l});
    expect(added).toMatchObject({tasks: 1, storedFiles: 1, storage: 2, extraLogins: 0});
    expect(l.tasks.map((t: any) => t.id)).toContain(U(21)); expect(l.storage.map((o: any) => o.bucket)).toContain('display');
    for (const q of sql.mock.calls.map((c: any) => c[0])) expect(q).toMatch(/project_id = any\(array\[/); // never "everything in the table"
    checkStoragePaths(l);
  });
  it('an extra login is recorded as extra; an owner or a malformed address is refused', async () => {
    const l = ledger(); await adoptExtras({sql: sqlFor([], [{id: U(30), email: 'x@gmail.test', is_owner: false}]), ledger: l, extraLogins: ['X@Gmail.test']});
    expect(l.profiles.find((p: any) => p.id === U(30))).toMatchObject({extra: true}); expect(l.authUsers.find((p: any) => p.id === U(30))).toMatchObject({extra: true});
    expect(foreignSql(l)).toContain(`id <> all(array['${U(30)}']::uuid[])`);
    await expect(adoptExtras({sql: sqlFor([], [{id: U(31), email: 'o@x.test', is_owner: true}]), ledger: ledger(), extraLogins: ['o@x.test']})).rejects.toThrow(/owner/);
    await expect(adoptExtras({sql: sqlFor(), ledger: ledger(), extraLogins: ["a'; drop table x; --@b.test"]})).rejects.toThrow(/plain email/);
  });
  it('memberships are removed by project or by demo login (a demo person added to a real project)', () => {
    expect(removalSql(ledger())).toMatch(/delete from public.memberships where project_id = any\(.*\) or user_id = any\(/);
  });
  it('auth deletion allows a typed extra login, still refuses any other non-demo login', async () => {
    const admin = (email: string) => ({auth: {admin: {getUserById: vi.fn(async () => ({data: {user: {email}}, error: null})), deleteUser: vi.fn(async () => ({error: null}))}}});
    const a = admin('me@gmail.test'); await removeAuthUsers(a as any, [{id: U(30), extra: true}]); expect(a.auth.admin.deleteUser).toHaveBeenCalled();
    const b = admin('me@gmail.test'); await expect(removeAuthUsers(b as any, [{id: U(30)}])).rejects.toThrow(/not a demo account/);
  });
  it('a real run with --adopt-extras saves the adopted ledger before deleting', async () => {
    const f = fake(); const l = ledger(); const i = {load: () => l, save: vi.fn(), archive: vi.fn()};
    const base = f.sql.getMockImplementation()!;
    f.sql.mockImplementation(async (q: string) => q.startsWith('select id from public.tasks') ? [{id: U(21)}] : q.startsWith('select id') ? [] : base(q));
    const r = await run({args: {...real(4), 'adopt-extras': true}, env, log: vi.fn(), clients: f as any, ledgerIO: i});
    expect(r.wrote).toBe(true); expect(i.save).toHaveBeenCalled();
  });
});

describe('ledger and assets', () => {
  it('records idempotently and round-trips through a file layer', () => {
    const l = emptyLedger(PROJECT_REF); record(l, 'projects', {id: U(1)}); record(l, 'projects', {id: U(1)}); expect(l.projects).toHaveLength(1);
    const mem: Record<string, string> = {};
    saveLedger(l, 'x/ledger.json', {mkdir: () => {}, write: (p: string, d: string) => { mem[p] = d; }, rename: (a: string, b: string) => { mem[b] = mem[a]; delete mem[a]; }} as any);
    const back = loadLedger('x/ledger.json', PROJECT_REF, {exists: () => true, read: (p: string) => mem[p]});
    expect(back.projects).toEqual([{id: U(1)}]);
    expect(() => loadLedger('x/ledger.json', 'otherref0000000000000', {exists: () => true, read: (p: string) => mem[p]})).toThrow(/belongs to project/);
    expect(() => record(l, 'nope', {})).toThrow();
  });
  it('generates real, small, valid files', async () => {
    const photo = await makeFile('photo', {tone: 2}); const pdf = await makeFile('pdf', {name: 'x'}); const xlsx = await makeFile('xlsx');
    expect([photo.bytes[0], photo.bytes[1]]).toEqual([0xff, 0xd8]);
    expect(Buffer.from(pdf.bytes.slice(0, 4)).toString()).toBe('%PDF');
    expect(Buffer.from(xlsx.bytes.slice(0, 2)).toString()).toBe('PK');
    for (const f of [photo, pdf, xlsx]) expect(f.bytes.length).toBeLessThan(1_000_000);
  });
});
