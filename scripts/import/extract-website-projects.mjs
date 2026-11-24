#!/usr/bin/env node
// Reads the PUBLIC project listing pages of the client's website and writes a local, git-ignored JSON file.
//   node scripts/import/extract-website-projects.mjs [--out=scripts/import/out/projects.local.json]
// Only public listing text: name, place, category, status, public page URL. No contacts, no finance, no files.
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

export const SITE = 'https://hy-ozma-ltd.com';
export const CATEGORIES = [
  {slug: 'private-projects', category: 'private'},
  {slug: 'restorants', category: 'restaurants'},
  {slug: 'shops-offices', category: 'shops-offices'},
];
const decode = s => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#8211;/g, '-').replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// Pure parser: listing page HTML -> items. Cards are <a ... href="..."> blocks whose first text is the status.
// Card background images live in the page's Elementor CSS: `.elementor-element-<id> { background-image: url(...) }`.
export function cardImages(css) {
  const out = {};
  for (const m of css.matchAll(/\.elementor-element-([0-9a-f]{7})[^{]*\{[^}]*?background-image:\s*url\(\s*['"]?([^)'"]+)/g)) out[m[1]] ??= m[2];
  return out;
}

export function parseListing(html, category, css = '') {
  const images = cardImages(css);
  const clean = html.replace(/<(script|style)[\s\S]*?<\/\1>/g, '');
  const items = [];
  for (const m of clean.matchAll(/<a class="elementor-element elementor-element-([0-9a-f]+)[^>]*href="([^"]+)">([\s\S]*?)<\/a>/g)) {
    const text = m[3].replace(/<[^>]+>/g, '\n').split('\n').map(x => decode(x.trim())).filter(Boolean);
    if (!['COMPLETED', 'COMING SOON'].includes(text[0]) || text.length < 3) continue;
    const [status, place, ...rest] = text;
    const url = m[2] === '#' ? null : new URL(m[2], SITE).toString();
    items.push({category, place, title: rest.join(' ').replace(/\s*-\s*$/, '').trim(), status: status === 'COMPLETED' ? 'completed' : 'coming_soon', sourceUrl: url, imageUrl: images[m[1]] ?? null});
  }
  return items;
}

export async function extract(fetchImpl = fetch) {
  const all = [];
  for (const c of CATEGORIES) {
    const res = await fetchImpl(`${SITE}/${c.slug}/`);
    if (!res.ok) throw new Error(`Fetching ${c.slug} failed with HTTP ${res.status}`);
    const html = await res.text();
    let css = '';
    for (const href of new Set([...html.matchAll(/href=['"]([^'"]*elementor\/css\/post-\d+\.css[^'"]*)['"]/g)].map(m => m[1]))) {
      const r = await fetchImpl(href); if (r.ok) css += await r.text();
    }
    all.push(...parseListing(html, c.category, css));
  }
  return all;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = (process.argv.find(a => a.startsWith('--out=')) ?? '--out=scripts/import/out/projects.local.json').slice(6);
  const items = await extract();
  mkdirSync(dirname(out), {recursive: true});
  writeFileSync(out, JSON.stringify({source: SITE, extractedAt: new Date().toISOString().slice(0, 10), items}, null, 2));
  console.log(`Wrote ${items.length} projects to ${out}`);
}
