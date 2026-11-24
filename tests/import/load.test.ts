import {readFileSync} from 'node:fs';
import {describe, expect, it, vi} from 'vitest';
import {PROJECT_REF} from '../../scripts/ops/lib.mjs';
import {buildPlan, grantDeveloper, load, toFields} from '../../scripts/import/load-projects.mjs';
import {parseListing} from '../../scripts/import/extract-website-projects.mjs';

const env = {SUPABASE_URL: `https://${PROJECT_REF}.supabase.co`, SUPABASE_PUBLISHABLE_KEY: 'p', GO_LIVE_OWNER_PASSWORD: 'x'};
const sample = JSON.parse(readFileSync('scripts/import/sample/projects.sample.json', 'utf8'));

describe('load-projects', () => {
  it('maps a row to create_project fields with no personal data', () => {
    const f = toFields(sample.items[0]);
    expect(f).toMatchObject({name: 'מסעדה לדוגמה - עיר לדוגמה', siteAddress: 'עיר לדוגמה', startDate: null});
    expect(f.contact.email).toBeNull();
  });
  it('uses stable request ids and flags family names', () => {
    const items = [...sample.items, {category: 'private', place: 'יהוד', title: 'עבודות גמר משפחת דוגמה', status: 'completed', sourceUrl: 'https://example.invalid/f/'}];
    const a = buildPlan(items); const b = buildPlan(items);
    expect(a.map((p: {requestId: string}) => p.requestId)).toEqual(b.map((p: {requestId: string}) => p.requestId));
    expect(new Set(a.map((p: {requestId: string}) => p.requestId)).size).toBe(3);
    expect(a[2].warnings).toHaveLength(1);
    expect(a[0].status).toBe('completed'); expect(a[1].status).toBe('active');
  });
  it('rejects duplicate source rows', () => { expect(() => buildPlan([sample.items[0], sample.items[0]])).toThrow(/Duplicate/); });
  it('dry run does not sign in or write', async () => {
    const db = {auth: {signInWithPassword: vi.fn()}, rpc: vi.fn()};
    const r = await load({args: {input: 'x'}, env, log: vi.fn(), clients: {db}, readInput: () => sample});
    expect(r.wrote).toBe(false); expect(db.auth.signInWithPassword).not.toHaveBeenCalled(); expect(db.rpc).not.toHaveBeenCalled();
  });
  it('real run creates each project once, completes finished ones, grants the developer', async () => {
    const rpcs: string[] = [];
    const tables: Record<string, unknown> = {profiles: {id: 'dev'}, projects: {id: 'p1', status: 'active', revision: 1}, memberships: null};
    const db = {
      auth: {signInWithPassword: vi.fn(async () => ({data: {}, error: null}))},
      rpc: vi.fn(async (n: string) => { rpcs.push(n); if (n === 'create_project') tables.memberships = null; if (n === 'set_membership') tables.memberships = {revision: 1, finance_access: false}; return {data: {id: 'p1', revision: 1}, error: null}; }),
      from: (t: string) => { const q: Record<string, unknown> = {}; for (const k of ['select', 'eq']) q[k] = () => q; q.maybeSingle = async () => ({data: tables[t], error: null}); q.single = async () => ({data: tables[t], error: null}); return q; },
    };
    await load({args: {confirm: true, 'project-ref': PROJECT_REF, 'owner-email': 'b@fake.test', 'developer-email': 'd@fake.test'}, env, log: vi.fn(), clients: {db}, readInput: () => sample});
    expect(rpcs.filter(r => r === 'create_project')).toHaveLength(2);
    expect(rpcs).toContain('set_project_status');
    expect(rpcs.filter(r => r === 'set_membership')).toHaveLength(2);
    expect(rpcs.filter(r => r === 'set_finance_access')).toHaveLength(2);
  });
  it('grantDeveloper is a no-op when access already exists', async () => {
    const db = {rpc: vi.fn(), from: () => { const q: Record<string, unknown> = {}; for (const k of ['select', 'eq']) q[k] = () => q; q.maybeSingle = async () => ({data: {revision: 3, finance_access: true}, error: null}); return q; }};
    await grantDeveloper(db, 'p', 'u'); expect(db.rpc).not.toHaveBeenCalled();
  });
});

describe('website extractor', () => {
  it('parses listing cards (status, place, title) and ignores everything else', () => {
    const html = `<a class="elementor-element x" href="/a/"><p>COMPLETED</p><h3>רמלה</h3><h3>אושי אושי</h3></a><a class="elementor-element x" href="#"><p>COMING SOON</p><h3>קרית אונו</h3><h3>MUCHA</h3></a><a class="elementor-element" href="/n/"><p>menu</p></a>`;
    expect(parseListing(html, 'restaurants')).toEqual([
      {category: 'restaurants', place: 'רמלה', title: 'אושי אושי', status: 'completed', sourceUrl: 'https://hy-ozma-ltd.com/a/'},
      {category: 'restaurants', place: 'קרית אונו', title: 'MUCHA', status: 'coming_soon', sourceUrl: null},
    ]);
  });
});
