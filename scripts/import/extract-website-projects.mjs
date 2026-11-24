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
export function parseListing(html, category) {
  const clean = html.replace(/<(script|style)[\s\S]*?<\/\1>/g, '');
  const items = [];
  for (const m of clean.matchAll(/<a class="elementor-element[^>]*href="([^"]+)">([\s\S]*?)<\/a>/g)) {
    const text = m[2].replace(/<[^>]+>/g, '\n').split('\n').map(x => decode(x.trim())).filter(Boolean);
    if (!['COMPLETED', 'COMING SOON'].includes(text[0]) || text.length < 3) continue;
    const [status, place, ...rest] = text;
    const url = m[1] === '#' ? null : new URL(m[1], SITE).toString();
    items.push({category, place, title: rest.join(' ').replace(/\s*-\s*$/, '').trim(), status: status === 'COMPLETED' ? 'completed' : 'coming_soon', sourceUrl: url});
  }
  return items;
}

export async function extract(fetchImpl = fetch) {
  const all = [];
  for (const c of CATEGORIES) {
    const res = await fetchImpl(`${SITE}/${c.slug}/`);
    if (!res.ok) throw new Error(`Fetching ${c.slug} failed with HTTP ${res.status}`);
    all.push(...parseListing(await res.text(), c.category));
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
