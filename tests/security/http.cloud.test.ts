import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createServerClient } from '@supabase/ssr';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { actor, clients, environment, membership, owner, project, readyFile, rpc, value, type Client, type TestActor } from '../db/support/cloud';

// P3.1 security, over HTTP: the real production build (`next start`, port 3199) against the cloud database.
// Callers authenticate with the same cookies the app sets. Fake data only; cleanup archives this file's two
// projects and deactivates its accounts, and removes its own storage object.
const PORT = 3199, BASE = `http://localhost:${PORT}`;
const ID = () => randomUUID();
let server: ChildProcess, admin: Client, ben: TestActor, mgr: TestActor, fin: TestActor, wrk: TestActor, out: TestActor;
let A: { id: string; revision: number }, B: { id: string; revision: number };
let selectedDoc: string, ownerDoc: string, pendingFile: string;
const mine: TestActor[] = [];
const objects: string[] = [];
const cookies = new Map<string, string>();
const log: string[] = [];

async function cookieFor(person: TestActor, tweak?: (session: Record<string, unknown>) => void): Promise<string> {
  const e = environment();
  const jar = new Map<string, string>();
  const session = (await person.client.auth.getSession()).data.session!;
  const ssr = createServerClient(e.url, e.publishable, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: list => list.forEach(c => jar.set(c.name, c.value)) } });
  const copy = { ...session } as unknown as Record<string, unknown>;
  await ssr.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  if (tweak) {
    tweak(copy);
    // setSession would refresh an expired token; write the tweaked session straight into the cookie format instead.
    const name = [...jar.keys()][0].replace(/\.\d+$/, '');
    jar.clear();
    jar.set(name, 'base64-' + Buffer.from(JSON.stringify(copy)).toString('base64url'));
  }
  return [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
}
const call = (path: string, who: string | null, init: RequestInit & { headers?: Record<string, string> } = {}) =>
  fetch(BASE + path, { redirect: 'manual', ...init, headers: { ...(who ? { cookie: cookies.get(who)! } : {}), ...(init.headers ?? {}) } });
const post = (path: string, who: string | null, body: unknown, headers: Record<string, string> = {}) =>
  call(path, who, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'content-type': 'application/json', origin: BASE, ...headers } });
const leaks = (text: string) => [/izjmvyguzbampoasvnru/, /sb_(secret|publishable)_/, /eyJ[A-Za-z0-9_-]{15,}\./, /\n\s+at .*\(.*:\d+:\d+\)/, /node_modules/, /postgres|pgrst|PGRST|supabase\.co/i, /ECONN|ENOTFOUND|stack/]
  .filter(re => re.test(text)).map(String);
const text = async (r: Response) => (await r.text()).slice(0, 20000);

beforeAll(async () => {
  expect(existsSync('.next/BUILD_ID'), 'run `npm run build` first').toBe(true);
  ({ admin } = clients());
  ben = await owner(admin);
  [mgr, fin, wrk, out] = await Promise.all(['hmgr', 'hfin', 'hwrk', 'hout'].map(l => actor(admin, ben.client, l)));
  mine.push(mgr, fin, wrk, out);
  [A, B] = [await project(ben.client, 'http-א'), await project(ben.client, 'http-ב')];
  await membership(ben.client, mgr.id, A.id, 'manager');
  const f = await membership(ben.client, fin.id, A.id, 'manager');
  await value(ben.client, 'set_finance_access', { userId: fin.id, projectId: A.id, enabled: true, expectedRevision: f.revision });
  await membership(ben.client, wrk.id, A.id, 'worker');
  await value(ben.client, 'create_transaction', { requestId: ID(), projectId: A.id, fields: { year: 2026, month: 1, day: null, kind: 'income', amount: 555, details: 'תנועה בדויה' } });
  await value(ben.client, 'create_transaction', { requestId: ID(), projectId: B.id, fields: { year: 2026, month: 1, day: null, kind: 'income', amount: 777, details: 'תנועה בדויה ב' } });
  // two real documents on A: one for the worker, one owner-only; each with a real (tiny) object so a link can be signed
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
  const make = async (access: unknown) => {
    const fileId = await readyFile(admin, mgr, A.id, 'document');
    await value(mgr.client, 'create_document', { projectId: A.id, fileId, category: 'plans', access: access as never });
    const auth = (await rpc(ben.client, 'authorize_file', { fileId, variant: 'original' })).data as { bucket: string; path: string };
    expect((await admin.storage.from(auth.bucket).upload(auth.path, png, { contentType: 'image/png' })).error).toBeNull();
    objects.push(auth.path);
    return fileId;
  };
  selectedDoc = await make({ mode: 'selected', userIds: [wrk.id] });
  ownerDoc = await make({ mode: 'owner' });
  pendingFile = ((await value<{ fileId: string }[]>(ben.client, 'begin_upload', { projectId: A.id, purpose: 'document', files: [{ clientId: ID(), name: 'ממתין.png', mime: 'image/png', sizeBytes: 8 }] }))[0]).fileId;
  for (const [k, p] of Object.entries({ ben, mgr, fin, wrk, out })) cookies.set(k, await cookieFor(p));
  server = spawn('npx', ['next', 'start', '-p', String(PORT)], { env: { ...process.env, NODE_ENV: 'production' }, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout?.on('data', d => log.push(String(d)));
  server.stderr?.on('data', d => log.push(String(d)));
  for (let i = 0; i < 60; i++) { try { await fetch(`${BASE}/sign-in`); break; } catch { await new Promise(r => setTimeout(r, 1000)); } }
}, 240_000);

afterAll(async () => {
  server?.kill('SIGTERM');
  if (admin && objects.length) await admin.storage.from('originals').remove(objects);
  if (!ben) return;
  for (const p of [A, B].filter(Boolean)) {
    const row = await ben.client.from('projects').select('revision').eq('id', p.id).single();
    if (row.data) await rpc(ben.client, 'set_project_archived', { id: p.id, expectedRevision: row.data.revision, archived: true });
  }
  for (const person of mine) {
    const row = await ben.client.from('profiles').select('revision').eq('id', person.id).single();
    if (row.data) await rpc(ben.client, 'set_user_active', { id: person.id, active: false, expectedRevision: row.data.revision });
  }
}, 120_000);

describe.sequential('unauthenticated callers', () => {
  const day = `projectId=${ID()}&date=2026-01-01&kind=day`;
  it('every API route answers 401 with a bare JSON error and no data', async () => {
    const calls: [string, Promise<Response>][] = [
      ['GET files', call(`/api/storage/files/${selectedDoc}`, null)],
      ['GET finance export', call(`/api/exports/finance?projectId=${A.id}&period=all`, null)],
      ['GET diary report', call(`/api/reports/diary?${day}`, null)],
      ['POST uploads', post('/api/storage/uploads', null, { projectId: A.id, purpose: 'document', files: [] })],
      ['POST complete', post(`/api/storage/uploads/${pendingFile}/complete`, null, {})],
    ];
    for (const [name, p] of calls) {
      const r = await p;
      const body = await text(r);
      expect(r.status, name).toBe(401);
      expect(JSON.parse(body), name).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } });
      expect(leaks(body), name).toEqual([]);
      expect(r.headers.get('cache-control'), name).toMatch(/no-store/);
    }
  });
  it('app pages send a signed-out visitor to sign-in and render no project data', async () => {
    for (const path of ['/', '/projects', '/finance', '/users', '/more', '/diary', `/projects/${A.id}`, `/projects/${A.id}/finance`, `/projects/${A.id}/edit/access`, '/reports/diary']) {
      const r = await call(path, null);
      const body = await text(r);
      const redirected = r.status >= 300 && r.status < 400 && /sign-in/.test(r.headers.get('location') ?? '');
      expect(redirected || r.status === 401 || r.status === 404, `${path} -> ${r.status}`).toBe(true);
      expect(body).not.toMatch(/http-[אב]|תנועה בדויה|סכום/);
    }
  });
  it('a malformed, expired or foreign cookie is treated as signed out', async () => {
    const forged = await cookieFor(wrk, s => { s.access_token = String(s.access_token).slice(0, -6) + 'AAAAAA'; s.refresh_token = 'forged' + ID().slice(0, 6); s.expires_at = 1; });
    const name = (cookies.get('wrk')!.split('=')[0]).replace(/\.\d+$/, '');
    expect(name).toMatch(/^sb-.*-auth-token$/);
    for (const cookie of [forged, `${name}=garbage`, `${name}=base64-e30`]) {
      const r = await call(`/api/storage/files/${selectedDoc}`, null, { headers: { cookie } });
      expect(r.status).toBe(401);
    }
  });
});

describe.sequential('CSRF and cross-origin', () => {
  it('state-changing API routes refuse a missing, foreign or cross-site origin, even with a valid session', async () => {
    const body = { projectId: A.id, purpose: 'document', files: [] };
    const bad: Record<string, string>[] = [{ origin: 'https://evil.example' }, { origin: 'null' }, { origin: BASE, 'sec-fetch-site': 'cross-site' }, { origin: '' }];
    for (const headers of bad) {
      for (const path of ['/api/storage/uploads', `/api/storage/uploads/${pendingFile}/complete`]) {
        const r = await call(path, 'ben', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } });
        expect(r.status, `${path} ${JSON.stringify(headers)}`).toBe(403);
      }
    }
    const noOrigin = await call('/api/storage/uploads', 'ben', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
    expect(noOrigin.status).toBe(403);
  });
  it('the report route refuses a cross-site request that carries the user\'s cookie', async () => {
    const r = await call(`/api/reports/diary?kind=day&projectId=${A.id}&date=2026-01-01`, 'ben', { headers: { 'sec-fetch-site': 'cross-site' } });
    expect(r.status).toBe(403);
  });
  it('a Server Action called from another origin is not executed', async () => {
    const manifest = JSON.parse(readFileSync('.next/server/server-reference-manifest.json', 'utf8')) as { node: Record<string, unknown> };
    const actionId = Object.keys(manifest.node)[0];
    expect(actionId).toBeTruthy();
    for (const origin of ['https://evil.example', 'null']) {
      const r = await call('/projects', 'ben', { method: 'POST', body: '[]', headers: { 'next-action': actionId, origin, 'content-type': 'text/plain;charset=UTF-8', host: `localhost:${PORT}` } });
      const body = await text(r);
      expect(r.status === 200 && /"ok":\s*true/.test(body), `origin ${origin} -> ${r.status}`).toBe(false);
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(leaks(body)).toEqual([]);
    }
  });
  it('no CORS: a foreign origin gets no allow-origin header on API routes or on preflight', async () => {
    for (const path of [`/api/storage/files/${selectedDoc}`, '/api/storage/uploads']) {
      const r = await call(path, 'ben', { headers: { origin: 'https://evil.example' } });
      expect(r.headers.get('access-control-allow-origin')).toBeNull();
      const pre = await call(path, null, { method: 'OPTIONS', headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' } });
      expect(pre.headers.get('access-control-allow-origin')).toBeNull();
    }
  });
});

describe.sequential('roles over HTTP: files, finance export, reports and uploads', () => {
  it('files: the selected worker is redirected to a short signed link; others and owner-only documents are 404 with no body detail', async () => {
    const ok = await call(`/api/storage/files/${selectedDoc}`, 'wrk');
    expect(ok.status).toBe(302);
    const location = ok.headers.get('location')!;
    expect(location).toMatch(/\/storage\/v1\/object\/sign\/originals\/.+\?token=/);
    expect(ok.headers.get('cache-control')).toMatch(/no-store/);
    expect((await fetch(location)).ok).toBe(true);
    expect((await call(`/api/storage/files/${selectedDoc}`, 'ben')).status).toBe(302);
    for (const who of ['fin', 'out'])  expect((await call(`/api/storage/files/${selectedDoc}`, who)).status, `${who} on selected`).toBe(404);
    for (const who of ['wrk', 'mgr', 'fin', 'out']) {
      const r = await call(`/api/storage/files/${ownerDoc}`, who);
      expect(r.status, `${who} on owner-only`).toBe(404);
      expect(r.headers.get('location')).toBeNull();
    }
    expect((await call(`/api/storage/files/${ownerDoc}`, 'ben')).status).toBe(302);
  });
  it('files: bad ids, variants and injection strings give a plain 4xx, never a stack, a 500 or a redirect', async () => {
    for (const id of ['not-a-uuid', '00000000-0000-0000-0000-000000000000', "'; drop table stored_files; --", '..%2F..%2Fetc%2Fpasswd', '%00', 'a'.repeat(5000)]) {
      const r = await call(`/api/storage/files/${id}`, 'ben');
      const body = await text(r);
      expect([400, 404], `${id.slice(0, 30)} -> ${r.status}`).toContain(r.status);
      expect(leaks(body)).toEqual([]);
    }
    for (const q of ['variant=thumb', 'variant=', 'variant=original&variant=display', "variant='"]) {
      const r = await call(`/api/storage/files/${selectedDoc}?${q}`, 'ben');
      expect(r.status === 302 || r.status === 400, `${q} -> ${r.status}`).toBe(true);
      expect(r.status).not.toBe(500);
    }
  });
  it('finance export: only the owner and the manager Ben opened finance for; never another project; the workbook holds only that project', async () => {
    const q = (id: string, extra = '') => `/api/exports/finance?projectId=${id}&period=all${extra}`;
    for (const who of ['wrk', 'mgr', 'out']) {
      const r = await call(q(A.id), who);
      const body = await text(r);
      expect([403, 404], `${who} -> ${r.status}`).toContain(r.status);
      expect(body).not.toMatch(/PK\u0003\u0004/);
      expect(r.headers.get('content-type')).toMatch(/json/);
    }
    for (const [who, id] of [['fin', A.id], ['ben', A.id], ['ben', B.id]] as const) {
      const r = await call(q(id), who);
      expect(r.status, `${who} ${id}`).toBe(200);
      expect(r.headers.get('content-type')).toMatch(/spreadsheetml/);
      expect(r.headers.get('content-disposition')).toMatch(/^attachment/);
      expect(r.headers.get('x-content-type-options')).toBe('nosniff');
      expect(r.headers.get('cache-control')).toMatch(/no-store/);
      expect((await r.arrayBuffer()).byteLength).toBeGreaterThan(1000);
    }
    expect([403, 404]).toContain((await call(q(B.id), 'fin')).status);
    expect([403, 404]).toContain((await call(q(B.id), 'mgr')).status);
  });
  it('finance export: odd or duplicated query parameters are refused with 400', async () => {
    for (const extra of ['&extra=1', `&projectId=${B.id}`, '&period=2026-13', '&day=abc', '&search=' + 'x'.repeat(100000)]) {
      const r = await call(`/api/exports/finance?projectId=${A.id}&period=all${extra}`, 'ben');
      expect([400, 414, 431], `${extra.slice(0, 20)} -> ${r.status}`).toContain(r.status);
    }
    expect((await call('/api/exports/finance', 'ben')).status).toBe(400);
    expect((await call(`/api/exports/finance?projectId=${encodeURIComponent("' or 1=1 --")}&period=all`, 'ben')).status).toBeLessThan(500);
  });
  it('diary report: outsiders and the wrong project are refused before any rendering; bad queries are 400', async () => {
    const day = (id: string) => `/api/reports/diary?kind=day&projectId=${id}&date=2026-01-01`;
    for (const [who, id] of [['out', A.id], ['wrk', B.id], ['mgr', B.id], ['fin', B.id]] as const) {
      const r = await call(day(id), who);
      expect([403, 404], `${who} ${id} -> ${r.status}`).toContain(r.status);
      expect(r.headers.get('content-type')).toMatch(/json/);
      expect(leaks(await text(r))).toEqual([]);
    }
    expect((await call(`/api/reports/diary?kind=entry&entryId=${ID()}`, 'out')).status).toBe(404);
    for (const bad of ['kind=x', 'kind=day', `kind=day&projectId=${A.id}`, `kind=day&projectId=${A.id}&date=2026-01-01&part=0`, `kind=day&projectId=${A.id}&date=2026-01-01&extra=1`, `kind=range&projectId=${A.id}&from=2026-01-01`])
      expect((await call(`/api/reports/diary?${bad}`, 'ben')).status, bad).toBe(400);
  });
  it('uploads: a worker cannot start a document upload, an outsider cannot start anything on A, a worker cannot complete the owner\'s pending file', async () => {
    const file = { clientId: ID(), name: 'בדיקה.png', mime: 'image/png', sizeBytes: 8 };
    expect((await post('/api/storage/uploads', 'wrk', { projectId: A.id, purpose: 'document', files: [file] })).status).toBe(403);
    expect((await post('/api/storage/uploads', 'mgr', { projectId: A.id, purpose: 'cover', files: [file] })).status).toBe(403);
    expect((await post('/api/storage/uploads', 'out', { projectId: A.id, purpose: 'diary', files: [file] })).status).toBe(404);
    expect([400, 413]).toContain((await post('/api/storage/uploads', 'mgr', { projectId: A.id, purpose: 'document', files: [{ ...file, mime: 'text/html' }] })).status);
    expect([400, 413]).toContain((await post('/api/storage/uploads', 'mgr', { projectId: A.id, purpose: 'document', files: [{ ...file, sizeBytes: 52428801 }] })).status);
    for (const who of ['wrk', 'out', 'mgr']) expect([403, 404], who).toContain((await post(`/api/storage/uploads/${pendingFile}/complete`, who, {})).status);
  });
  it('uploads: malformed bodies are 400 and a very large body does not crash or leak', async () => {
    for (const body of ['{', '', 'null', '[]', '"x"', '{"files":{}}']) {
      const r = await post('/api/storage/uploads', 'ben', body);
      expect([400, 404], `${body} -> ${r.status}`).toContain(r.status);
      expect(leaks(await text(r))).toEqual([]);
    }
    const big = await post('/api/storage/uploads', 'ben', JSON.stringify({ projectId: A.id, purpose: 'document', files: [{ clientId: ID(), name: 'x'.repeat(6_000_000), mime: 'image/png', sizeBytes: 8 }] }));
    expect(big.status).toBeLessThan(500);
    expect(leaks(await text(big))).toEqual([]);
  });
});

describe.sequential('deployed-app basics: headers, cookies, error text', () => {
  const sample = async () => {
    const out: Record<string, Response> = {};
    out.signIn = await call('/sign-in', null);
    out.api = await call(`/api/storage/files/${selectedDoc}`, null);
    out.page = await call('/projects', 'ben');
    out.notFound = await call('/no-such-page-' + ID(), 'ben');
    return out;
  };
  it('responses do not advertise a server version', async () => {
    for (const [name, r] of Object.entries(await sample())) expect(r.headers.get('server') ?? '', name).not.toMatch(/\d/);
  });
  it('F-HDR-6 responses do not carry X-Powered-By (set poweredByHeader: false)', async () => {
    expect((await call('/sign-in', null)).headers.get('x-powered-by')).toBeNull();
  });
  it('signed-in pages and all API responses are not cacheable', async () => {
    const s = await sample();
    for (const name of ['api', 'page']) expect(s[name].headers.get('cache-control'), name).toMatch(/no-store/);
  });
  it('error and not-found pages leak no internals', async () => {
    const r = await call('/no-such-page-' + ID(), 'ben');
    const body = await text(r);
    expect(r.status).toBe(404);
    expect(leaks(body)).toEqual([]);
    for (const path of ['/projects/not-a-uuid', `/projects/${B.id}`, `/projects/${B.id}/finance`]) {
      const p = await call(path, 'wrk');
      const b = await text(p);
      expect([200, 404], `${path} -> ${p.status}`).toContain(p.status);
      // B must look exactly like a project that does not exist: same page title, no B data
      const title = (h: string) => /<title>([^<]*)<\/title>/.exec(h)?.[1];
      const ghost = await text(await call(path.replace(B.id, ID()), 'wrk'));
      expect(title(b), path).toBe(title(ghost));
      expect(b, path).not.toMatch(/http-ב|תנועה בדויה/);
      expect(leaks(b), path).toEqual([]);
    }
  });
  it('the worker and the manager cannot open another project or finance screens through the app pages', async () => {
    const finPage = await text(await call(`/projects/${A.id}/finance`, 'wrk'));
    expect(finPage).not.toMatch(/תנועה בדויה|555/);
    const mgrPage = await text(await call(`/projects/${A.id}/finance`, 'mgr'));
    expect(mgrPage).not.toMatch(/תנועה בדויה|555/);
    const users = await call('/users', 'wrk');
    expect(await text(users)).not.toMatch(/p12-.*@example\.invalid/);
    const overall = await text(await call('/finance', 'fin'));
    expect(overall).not.toMatch(/777|תנועה בדויה ב/);
  });
  it('session cookies set by the app are HttpOnly, SameSite=Lax, Secure and path-wide', async () => {
    // An expired access token with a live refresh token makes the proxy refresh the session and set cookies.
    const expired = await cookieFor(wrk, s => { s.expires_at = 1; });
    const r = await call('/projects', null, { headers: { cookie: expired } });
    const set = r.headers.getSetCookie().filter(c => /auth-token/.test(c));
    expect(set.length, 'proxy should have refreshed and re-set the session cookie').toBeGreaterThan(0);
    for (const c of set) {
      expect(c, c.slice(0, 40)).toMatch(/;\s*HttpOnly/i);
      expect(c).toMatch(/;\s*SameSite=Lax/i);
      expect(c).toMatch(/;\s*Secure/i);
      expect(c).toMatch(/;\s*Path=\//i);
    }
  });
  it('the server log of this run holds no key, token or cookie value', () => {
    const all = log.join('');
    expect(all).not.toMatch(/sb_secret_|eyJ[A-Za-z0-9_-]{15,}\.|auth-token=|base64-ey/);
  });
});

describe.sequential('security headers (deployed-app review)', () => {
  const headers = async () => (await call('/sign-in', null)).headers;
  // F1/F2 fixed in next.config.ts (docs/qa/SECURITY.md).
  it('F-HDR-1 X-Content-Type-Options: nosniff on pages', async () => { expect((await headers()).get('x-content-type-options')).toBe('nosniff'); });
  it('F-HDR-2 clickjacking protection (frame-ancestors or X-Frame-Options)', async () => {
    const h = await headers();
    expect(/frame-ancestors/i.test(h.get('content-security-policy') ?? '') || /deny|sameorigin/i.test(h.get('x-frame-options') ?? '')).toBe(true);
  });
  it('F-HDR-3 Referrer-Policy', async () => { expect((await headers()).get('referrer-policy')).toMatch(/strict-origin|no-referrer|same-origin/); });
  it('F-HDR-4 Content-Security-Policy', async () => { expect((await headers()).get('content-security-policy')).toBeTruthy(); });
  it('F-HDR-5 Permissions-Policy', async () => { expect((await headers()).get('permissions-policy')).toBeTruthy(); });
});
