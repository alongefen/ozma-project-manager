#!/usr/bin/env node
// Adds a cover (banner) image to each loaded project, using the PUBLIC images from the client's website.
//   node --env-file=<env> scripts/import/load-covers.mjs --owner-email=<ben>                 (dry run: lists project -> image)
//   add: --confirm --project-ref=<ref>   and GO_LIVE_OWNER_PASSWORD in the environment
// Env: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY (+ GO_LIVE_OWNER_PASSWORD for a real run).
// Mirrors the app's upload path: begin_upload -> signed upload -> display copy -> system_finish_upload -> set_project_cover.
// Projects that already have an active cover are skipped, so a retry never duplicates.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import sharp from 'sharp';
import {parseArgs, requireEnv, resolveMode, stableUuid} from '../ops/lib.mjs';
import {toFields} from './load-projects.mjs';

const MAX = 25 * 1024 * 1024;
const SITE_HOST = 'hy-ozma-ltd.com';
export function sniffMime(b) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (Buffer.from(b.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (Buffer.from(b.subarray(0, 4)).toString() === 'RIFF' && Buffer.from(b.subarray(8, 12)).toString() === 'WEBP') return 'image/webp';
  return null;
}
export function sessionIdOf(accessToken) {
  const claims = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString());
  if (!claims.session_id) throw new Error('No session in the owner token');
  return claims.session_id;
}
export function plan(items) {
  return items.filter(i => i.imageUrl).map(i => ({name: toFields(i).name, imageUrl: new URL(i.imageUrl, 'https://hy-ozma-ltd.com').toString()}));
}
async function must(promise, what) {
  const {data, error} = await promise;
  if (error) throw new Error(`${what} failed (${error.message ?? error.code})`);
  return data;
}
const display = bytes => sharp(Buffer.from(bytes), {failOn: 'error', limitInputPixels: 100_000_000}).rotate().resize({width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true}).jpeg({quality: 80}).toBuffer();

export async function loadCovers({args, env, log = console.log, clients = /** @type {any} */ (undefined), fetchImpl = fetch, readInput = p => JSON.parse(readFileSync(p, 'utf8'))}) {
  const mode = resolveMode(args, env);
  const rows = plan(readInput(String(args.input ?? 'scripts/import/out/projects.local.json')).items);
  log(JSON.stringify({mode: mode.write ? 'REAL RUN' : 'DRY RUN', covers: rows.length, distinctImages: new Set(rows.map(r => r.imageUrl)).size, sample: rows.slice(0, 3).map(r => `${r.name} <- ${r.imageUrl.split('/').pop()}`)}, null, 2));
  if (!mode.write) { log('Dry run only. Nothing was changed.'); return {wrote: false, rows}; }
  const e = requireEnv(env, ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'GO_LIVE_OWNER_PASSWORD']);
  const ownerEmail = String(args['owner-email'] ?? '').trim().toLowerCase();
  if (!ownerEmail) throw new Error('--owner-email is required');
  const noSession = {auth: {persistSession: false, autoRefreshToken: false}};
  const db = clients?.db ?? createClient(e.SUPABASE_URL, e.SUPABASE_PUBLISHABLE_KEY, noSession);
  const admin = clients?.admin ?? createClient(e.SUPABASE_URL, e.SUPABASE_SECRET_KEY, noSession);
  const signed = await must(db.auth.signInWithPassword({email: ownerEmail, password: e.GO_LIVE_OWNER_PASSWORD}), 'Signing in as the owner');
  const sessionId = sessionIdOf(signed.session.access_token);
  const actorId = signed.user.id;
  let done = 0, skipped = 0;
  for (const row of rows) {
    const project = await must(db.from('projects').select('id,revision').eq('name', row.name).single(), `Finding "${row.name}"`);
    const existing = await must(db.from('project_covers').select('id').eq('project_id', project.id).eq('is_active', true).maybeSingle(), 'Reading covers');
    if (existing) { skipped++; continue; }
    if (new URL(row.imageUrl).hostname !== SITE_HOST) throw new Error(`Refusing a non-site image URL for "${row.name}"`);
    const res = await fetchImpl(row.imageUrl, {signal: AbortSignal.timeout(30_000)});
    if (!res.ok) throw new Error(`Downloading ${row.imageUrl.split('/').pop()} failed (HTTP ${res.status})`);
    if (Number(res.headers.get('content-length') ?? 0) > MAX) throw new Error(`Image too large for "${row.name}"`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const mime = sniffMime(bytes);
    if (!mime || bytes.length > MAX) throw new Error(`Unsupported or too large image for "${row.name}"`);
    const raw = row.imageUrl.split('/').pop();
    let name = raw; try { name = decodeURIComponent(raw); } catch { /* keep the raw name */ }
    name = name.slice(0, 200);
    const [desc] = await must(db.rpc('begin_upload', {input: {projectId: project.id, purpose: 'cover', files: [{clientId: stableUuid(`cover:${row.name}`), name, mime, sizeBytes: bytes.length}]}}), 'Starting the upload');
    const target = await must(admin.storage.from(desc.bucket).createSignedUploadUrl(desc.path, {upsert: false}), 'Creating the upload URL');
    await must(admin.storage.from(desc.bucket).uploadToSignedUrl(desc.path, target.token, bytes, {contentType: mime}), 'Uploading the original');
    const shown = await display(bytes);
    const displayPath = `${project.id}/${desc.fileId}.jpg`;
    await must(admin.storage.from('display').upload(displayPath, shown, {contentType: 'image/jpeg', upsert: false}), 'Uploading the display copy');
    await must(admin.rpc('system_finish_upload', {input: {fileId: desc.fileId, actorId, sessionId, state: 'ready', mime, sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), displayState: 'ready', displayPath}}), 'Finishing the upload');
    await must(db.rpc('set_project_cover', {input: {id: project.id, expectedRevision: project.revision, fileId: desc.fileId}}), 'Setting the cover');
    done++;
  }
  log(`Covers set: ${done}, already had one: ${skipped}.`);
  return {wrote: true, done, skipped};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  loadCovers({args: parseArgs(process.argv.slice(2)), env: process.env}).catch(err => { console.error(err.message); process.exit(1); });
}
