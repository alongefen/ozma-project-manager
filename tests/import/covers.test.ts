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
});
