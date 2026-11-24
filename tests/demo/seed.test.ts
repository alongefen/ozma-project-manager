/* eslint-disable @typescript-eslint/no-explicit-any */
import {describe, expect, it, vi} from 'vitest';
import {PROJECT_REF} from '../../scripts/ops/lib.mjs';
import {seed, sessionIdOf} from '../../scripts/demo/seed-demo.mjs';
import {buildPlan, countPlan, txDate} from '../../scripts/demo/plan.mjs';
import {emptyLedger} from '../../scripts/demo/ledger.mjs';

const env = {SUPABASE_URL: `https://${PROJECT_REF}.supabase.co`, SUPABASE_PUBLISHABLE_KEY: 'p', SUPABASE_SECRET_KEY: 's', GO_LIVE_OWNER_PASSWORD: 'pw'};
const real = {confirm: true, 'project-ref': PROJECT_REF, 'owner-email': 'owner@real.test'};
const plan = buildPlan(new Date('2026-11-24T10:00:00Z'));

function fakes() {
  let n = 0; const calls: string[] = []; const reqIds: Record<string, Set<string>> = {};
  const rpcFor = (who: string) => vi.fn(async (name: string, {input}: any) => {
    calls.push(`${who}:${name}`);
    if (input?.requestId) { (reqIds[name] ??= new Set()).add(input.requestId); }
    if (name === 'begin_upload') return {data: [{clientId: input.files[0].clientId, fileId: `f${++n}`, bucket: 'originals', path: `${input.projectId}/f${n}`}], error: null};
    return {data: {id: `id${++n}`, revision: 1}, error: null};
  });
  const mkDb = (who: string) => ({rpc: rpcFor(who), from: () => ({select: () => { const r: any = {eq: () => r, single: async () => ({data: {revision: 1}, error: null}), then: (res: any) => res({data: [], error: null})}; return r; }})});
  const admin = {
    auth: {admin: {createUser: vi.fn(async ({email}: any) => ({data: {user: {id: `auth-${email}`}}, error: null})), updateUserById: vi.fn(async () => ({data: {}, error: null}))}},
    storage: {from: vi.fn(() => ({upload: vi.fn(async () => ({error: null}))}))},
    rpc: vi.fn(async (name: string) => { calls.push(`admin:${name}`); return {data: {}, error: null}; }),
  };
  const signIn = vi.fn(async (email: string) => ({db: mkDb(email), userId: `u-${email}`, sessionId: 's'}));
  return {admin, signIn, calls, reqIds};
}
const files = async (kind: string) => ({bytes: new Uint8Array([1, 2, 3]), mime: kind === 'pdf' ? 'application/pdf' : 'image/jpeg', display: kind === 'photo'});

describe('demo plan', () => {
  it('everything is marked fictional', () => {
    expect(plan.projects.every(p => p.fields.name.startsWith('דוגמה: '))).toBe(true);
    expect(plan.people.every(p => p.email.endsWith('@example.invalid') && p.name.endsWith('(דמו)'))).toBe(true);
    expect(JSON.stringify(plan)).not.toMatch(/@(gmail|walla|outlook)/);
  });
  it('matches the brief: counts, finance difference, owner-only docs, one finished project', () => {
    const c = countPlan(plan);
    expect(c).toMatchObject({projects: 3, completedProjects: 1, managers: 2, workers: 3, financeOpen: 1, covers: 3});
    expect(c.diaryEntries).toBeGreaterThanOrEqual(18); expect(c.diaryFiles).toBeGreaterThanOrEqual(4);
    expect(plan.projects.every(p => p.diary.length >= 6 && p.diary.length <= 10 && p.docs.length >= 3 && p.docs.length <= 5 && p.txs.length >= 10 && p.txs.length <= 15)).toBe(true);
    expect(plan.projects.every(p => p.docs.some(d => d.access.mode === 'owner'))).toBe(true);
    expect(c.cancelledTransactions).toBe(3); expect(c.correctedTransactions).toBe(2);
    expect(plan.projects.every(p => p.diary.every(e => e.by === 'owner' || p.members.some(m => m.user === e.by)))).toBe(true);
    expect(plan.projects.every(p => p.txs.every(t => ['owner', 'cancel'].includes(t.by) || t.by.startsWith('fix:') || p.members.find(m => m.user === t.by)?.finance))).toBe(true);
  });
  it('transaction dates never land in the future', () => {
    const d = txDate(new Date('2026-11-24T00:00:00Z'), 0, 28); expect(d).toEqual({year: 2026, month: 11, day: 24});
    expect(txDate(new Date('2026-11-24T00:00:00Z'), 1, 31)).toEqual({year: 2026, month: 10, day: 31});
  });
});

describe('seed-demo', () => {
  it('dry run is offline: no clients, no ledger', async () => {
    const io = {load: vi.fn(), save: vi.fn()};
    const r = await seed({args: {}, env, log: vi.fn(), print: vi.fn(), plan, ledgerIO: io});
    expect(r.wrote).toBe(false); expect(io.load).not.toHaveBeenCalled(); expect(io.save).not.toHaveBeenCalled();
  });
  it('refuses a real run without the typed project ref or with a wrong host', async () => {
    await expect(seed({args: {confirm: true}, env, log: vi.fn(), print: vi.fn(), plan})).rejects.toThrow(/project-ref/);
    await expect(seed({args: real, env: {...env, SUPABASE_URL: 'https://other.supabase.co'}, log: vi.fn(), print: vi.fn(), plan})).rejects.toThrow(/SUPABASE_URL/);
  });
  it('refuses a demo-domain owner and a missing owner password', async () => {
    await expect(seed({args: {...real, 'owner-email': 'x@example.invalid'}, env, log: vi.fn(), print: vi.fn(), plan, clients: fakes() as any})).rejects.toThrow(/real owner/);
    await expect(seed({args: real, env: {...env, GO_LIVE_OWNER_PASSWORD: ''}, log: vi.fn(), print: vi.fn(), plan})).rejects.toThrow(/GO_LIVE_OWNER_PASSWORD/);
  });
  it('real run: ledger gets every created row, passwords printed once and never logged', async () => {
    const f = fakes(); const ledger = emptyLedger(PROJECT_REF); const save = vi.fn(); const log = vi.fn(); const print = vi.fn();
    await seed({args: real, env, log, print, plan, clients: f as any, files, ledgerIO: {load: () => ledger, save}});
    expect(ledger.authUsers).toHaveLength(5); expect(ledger.profiles).toHaveLength(5); expect(ledger.projects).toHaveLength(3);
    expect(ledger.diaryEntries).toHaveLength(countPlan(plan).diaryEntries); expect(ledger.documents).toHaveLength(countPlan(plan).documents);
    expect(ledger.tasks).toHaveLength(countPlan(plan).tasks); expect(ledger.transactions).toHaveLength(countPlan(plan).transactions);
    expect(ledger.memberships).toHaveLength(countPlan(plan).memberships);
    expect(ledger.storedFiles.length).toBeGreaterThanOrEqual(3 + 4 + countPlan(plan).documents);
    expect(ledger.storage.some((s: any) => s.bucket === 'display')).toBe(true);
    expect(print).toHaveBeenCalledTimes(5);
    const pw = print.mock.calls.map(c => String(c[0]).split(' ').pop());
    for (const p of pw) { expect(log.mock.calls.flat().join('\n')).not.toContain(p); expect(JSON.stringify(ledger)).not.toContain(p); }
    expect(f.calls.filter(c => c.endsWith('set_finance_access'))).toHaveLength(1);
    expect(f.calls.filter(c => c.endsWith('set_project_status'))).toHaveLength(1);
    // the finished project is closed only after its last write
    const closeAt = f.calls.findIndex(c => c.endsWith('set_project_status'));
    expect(f.calls.slice(closeAt).some(c => /create_transaction|create_entry|create_task/.test(c))).toBe(false);
    expect(f.calls.filter(c => c.endsWith('cancel_transaction'))).toHaveLength(3);
    expect(f.calls.some(c => c.startsWith('owner@real.test:') && c.endsWith('create_entry'))).toBe(true);
    expect(f.calls.some(c => c.startsWith('demo.worker.avi@example.invalid:create_entry'))).toBe(true);
  });
  it('a retry reuses finished steps: no duplicate rows, no second upload', async () => {
    const f = fakes(); const ledger = emptyLedger(PROJECT_REF);
    const run = () => seed({args: real, env, log: vi.fn(), print: vi.fn(), plan, clients: f as any, files, ledgerIO: {load: () => ledger, save: vi.fn()}});
    await run(); const first = f.calls.filter(c => /begin_upload|create_entry|create_document/.test(c)).length;
    await run();
    expect(f.calls.filter(c => /begin_upload|create_entry|create_document/.test(c)).length).toBe(first);
    expect(ledger.authUsers).toHaveLength(5); expect(f.admin.auth.admin.createUser).toHaveBeenCalledTimes(5); expect(f.admin.auth.admin.updateUserById).toHaveBeenCalledTimes(5);
  });
  it('request ids are fixed per item and unique', async () => {
    const f = fakes(); await seed({args: real, env, log: vi.fn(), print: vi.fn(), plan, clients: f as any, files, ledgerIO: {load: () => emptyLedger(PROJECT_REF), save: vi.fn()}});
    const n = countPlan(plan);
    expect(f.reqIds.create_entry.size).toBe(n.diaryEntries); expect(f.reqIds.create_transaction.size).toBe(n.transactions);
    expect(f.reqIds.create_task.size).toBe(n.tasks); expect(f.reqIds.create_project.size).toBe(3);
    const again = buildPlan(new Date('2026-12-01T00:00:00Z'));
    expect(again.stableIds.entry(again.projects[0], again.projects[0].diary[0])).toBe(plan.stableIds.entry(plan.projects[0], plan.projects[0].diary[0]));
  });
  it('a failing database call stops the run and leaves a ledger that remove can use', async () => {
    const f = fakes(); const ledger = emptyLedger(PROJECT_REF);
    f.signIn.mockImplementationOnce((async () => ({db: {rpc: vi.fn(async (name: string) => name === 'create_profile' ? {data: null, error: {message: 'boom'}} : {data: {id: 'x', revision: 1}, error: null})}, userId: 'o', sessionId: 's'})) as any);
    await expect(seed({args: real, env, log: vi.fn(), print: vi.fn(), plan, clients: f as any, files, ledgerIO: {load: () => ledger, save: vi.fn()}})).rejects.toThrow(/Creating the profile/);
    expect(ledger.authUsers).toHaveLength(1);
  });
  it('reads the session id from an access token', () => {
    const t = `a.${Buffer.from(JSON.stringify({session_id: 'abc'})).toString('base64url')}.c`;
    expect(sessionIdOf(t)).toBe('abc'); expect(() => sessionIdOf('a.e30.c')).toThrow();
  });
});
