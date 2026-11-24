import {describe, expect, it, vi} from 'vitest';
import {PROJECT_REF} from '../../scripts/ops/lib.mjs';
import {loadCovers, plan, sessionIdOf, sniffMime} from '../../scripts/import/load-covers.mjs';
import {cardImages, parseListing} from '../../scripts/import/extract-website-projects.mjs';

const env = {SUPABASE_URL: `https://${PROJECT_REF}.supabase.co`};
const items = [{category: 'restaurants', place: 'עיר', title: 'מסעדה', status: 'completed', sourceUrl: null, imageUrl: '/wp-content/uploads/a.webp'}, {category: 'private', place: 'ישוב', title: 'בית', status: 'completed', sourceUrl: null, imageUrl: null}];

describe('covers', () => {
  it('reads card images from Elementor css and attaches them to cards', () => {
    const css = '.elementor-394 .elementor-element.elementor-element-93c8ccb:not(.x){background-image:url("https://s.test/a.webp");}';
    expect(cardImages(css)).toEqual({'93c8ccb': 'https://s.test/a.webp'});
    const html = '<a class="elementor-element elementor-element-93c8ccb e-con" href="/a/"><p>COMPLETED</p><h3>עיר</h3><h3>מסעדה</h3></a>';
    expect(parseListing(html, 'restaurants', css)[0].imageUrl).toBe('https://s.test/a.webp');
    expect(parseListing(html, 'restaurants')[0].imageUrl).toBeNull();
  });
  it('plans only rows with an image and resolves relative urls', () => {
    expect(plan(items)).toEqual([{name: 'מסעדה - עיר', imageUrl: 'https://hy-ozma-ltd.com/wp-content/uploads/a.webp'}]);
  });
  it('sniffs image types and rejects others', () => {
    expect(sniffMime(Uint8Array.from([0xff, 0xd8, 0xff, 0]))).toBe('image/jpeg');
    expect(sniffMime(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe('image/png');
    expect(sniffMime(new TextEncoder().encode('RIFF0000WEBPxxxx'))).toBe('image/webp');
    expect(sniffMime(new TextEncoder().encode('%PDF-1.7'))).toBeNull();
  });
  it('reads the session id from a token', () => {
    const t = `h.${Buffer.from(JSON.stringify({session_id: 's1'})).toString('base64url')}.s`;
    expect(sessionIdOf(t)).toBe('s1');
    expect(() => sessionIdOf(`h.${Buffer.from('{}').toString('base64url')}.s`)).toThrow();
  });
  it('dry run touches nothing', async () => {
    const db = {auth: {signInWithPassword: vi.fn()}};
    const r = await loadCovers({args: {}, env, log: vi.fn(), clients: {db, admin: {}}, readInput: () => ({items})});
    expect(r.wrote).toBe(false); expect(db.auth.signInWithPassword).not.toHaveBeenCalled();
  });
  it('a real run needs the typed project ref', async () => {
    await expect(loadCovers({args: {confirm: true}, env, log: vi.fn(), readInput: () => ({items})})).rejects.toThrow(/project-ref/);
  });
  it('real run: skips projects with a cover, refuses foreign hosts, runs the upload steps in order', async () => {
    const calls: string[] = [];
    const jwt = `h.${Buffer.from(JSON.stringify({session_id: 's1'})).toString('base64url')}.s`;
    const png = await (await import('sharp')).default({create: {width: 4, height: 4, channels: 3, background: '#fff'}}).png().toBuffer();
    let hasCover = false;
    const q = (t: string) => { const o: Record<string, unknown> = {}; for (const k of ['select', 'eq']) o[k] = () => o; o.single = async () => ({data: {id: 'p1', revision: 1}, error: null}); o.maybeSingle = async () => ({data: hasCover ? {id: 'c'} : null, error: null}); void t; return o; };
    const db = {auth: {signInWithPassword: async () => ({data: {session: {access_token: jwt}, user: {id: 'u1'}}, error: null})}, from: q, rpc: async (n: string) => { calls.push(n); return {data: n === 'begin_upload' ? [{fileId: 'f1', bucket: 'originals', path: 'p1/f1'}] : {}, error: null}; }};
    const bucket = (b: string) => ({createSignedUploadUrl: async () => ({data: {token: 't'}, error: null}), uploadToSignedUrl: async () => { calls.push('up:' + b); return {data: {}, error: null}; }, upload: async () => { calls.push('up:' + b); return {data: {}, error: null}; }});
    const admin = {storage: {from: bucket}, rpc: async (n: string) => { calls.push(n); return {data: {}, error: null}; }};
    const e = {...env, SUPABASE_PUBLISHABLE_KEY: 'p', SUPABASE_SECRET_KEY: 's', GO_LIVE_OWNER_PASSWORD: 'x'};
    const args = {confirm: true, 'project-ref': PROJECT_REF, 'owner-email': 'b@fake.test'};
    const input = {items: [{...items[0], imageUrl: 'https://hy-ozma-ltd.com/a.png'}]};
    const fetchOk = vi.fn(async () => new Response(png, {status: 200}));
    await loadCovers({args, env: e, log: vi.fn(), clients: {db, admin}, fetchImpl: fetchOk, readInput: () => input});
    expect(calls).toEqual(['begin_upload', 'up:originals', 'up:display', 'system_finish_upload', 'set_project_cover']);
    calls.length = 0; hasCover = true;
    const r = await loadCovers({args, env: e, log: vi.fn(), clients: {db, admin}, fetchImpl: fetchOk, readInput: () => input});
    expect(r).toMatchObject({done: 0, skipped: 1}); expect(calls).toEqual([]);
    hasCover = false;
    await expect(loadCovers({args, env: e, log: vi.fn(), clients: {db, admin}, fetchImpl: fetchOk, readInput: () => ({items: [{...items[0], imageUrl: 'https://evil.test/a.png'}]})})).rejects.toThrow(/non-site/);
  });
});
