#!/usr/bin/env node
// Loads the approved website projects through the app's own database functions, as the owner (Ben).
//   node --env-file=<env> scripts/import/load-projects.mjs --input=scripts/import/out/projects.local.json \
//        --owner-email=<ben> --developer-email=<alon>            (dry run: prints the plan, writes nothing)
//   add: --confirm --project-ref=<ref>   and set GO_LIVE_OWNER_PASSWORD in the environment for the real run
// Env: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY (+ GO_LIVE_OWNER_PASSWORD for a real run).
// Each row has a fixed request id, so a retry never duplicates a project.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {parseArgs, requireEnv, resolveMode, stableUuid} from '../ops/lib.mjs';

const PLACEHOLDER = 'יש להשלים';

export function toFields(item) {
  const title = String(item.title ?? '').trim();
  const place = String(item.place ?? '').trim();
  if (!title || !place) throw new Error(`Row without a title or place: ${JSON.stringify(item.sourceUrl ?? title)}`);
  const name = place.includes(title) || title.includes(place) ? (title.length >= place.length ? title : place) : `${title} - ${place}`;
  return {
    name, businessName: title, siteAddress: place,
    contact: {name: PLACEHOLDER, phone: PLACEHOLDER, email: null, roleTitle: null}, // the website carries no client contact
    startDate: null, endDate: null, accessNotes: null,
  };
}

export function buildPlan(items) {
  const seen = new Set();
  return items.map(item => {
    const fields = toFields(item);
    const key = item.sourceUrl ?? `${item.category}:${fields.name}`;
    if (seen.has(key)) throw new Error(`Duplicate source row: ${key}`);
    seen.add(key);
    return {requestId: stableUuid(`project:${key}`), fields, status: item.status === 'completed' ? 'completed' : 'active', warnings: /משפחת/.test(item.title) ? ['family name in the title: confirm it may be shown'] : []};
  });
}

async function must(promise, what) {
  const {data, error} = await promise;
  if (error) throw new Error(`${what} failed (${error.message ?? error.code})`);
  return data;
}

export async function load({args, env, log = console.log, clients, readInput = p => JSON.parse(readFileSync(p, 'utf8'))}) {
  const mode = resolveMode(args, env);
  const input = readInput(String(args.input ?? 'scripts/import/out/projects.local.json'));
  const plan = buildPlan(input.items);
  const counts = {total: plan.length, completed: plan.filter(p => p.status === 'completed').length, active: plan.filter(p => p.status === 'active').length};
  log(JSON.stringify({mode: mode.write ? 'REAL RUN' : 'DRY RUN', ...counts, warnings: plan.flatMap(p => p.warnings.map(w => `${p.fields.name}: ${w}`))}, null, 2));
  if (!mode.write) { log('Dry run only. Nothing was changed.'); return {wrote: false, plan}; }
  const e = requireEnv(env, ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'GO_LIVE_OWNER_PASSWORD']);
  const ownerEmail = String(args['owner-email'] ?? '').trim().toLowerCase();
  const developerEmail = String(args['developer-email'] ?? '').trim().toLowerCase();
  if (!ownerEmail) throw new Error('--owner-email is required');
  const db = clients?.db ?? createClient(e.SUPABASE_URL, e.SUPABASE_PUBLISHABLE_KEY, {auth: {persistSession: false, autoRefreshToken: false}});
  await must(db.auth.signInWithPassword({email: ownerEmail, password: e.GO_LIVE_OWNER_PASSWORD}), 'Signing in as the owner');
  let developer = null;
  if (developerEmail) {
    developer = await must(db.from('profiles').select('id').eq('email', developerEmail).maybeSingle(), 'Finding the developer account');
    if (!developer) throw new Error('Developer account not found; run seed-accounts first');
  }
  let created = 0;
  for (const row of plan) {
    const saved = await must(db.rpc('create_project', {input: {requestId: row.requestId, fields: row.fields}}), `Creating "${row.fields.name}"`);
    const project = await must(db.from('projects').select('id,status,revision').eq('id', saved.id).single(), 'Reading the project');
    if (row.status === 'completed' && project.status !== 'completed') {
      await must(db.rpc('set_project_status', {input: {id: project.id, expectedRevision: project.revision, status: 'completed'}}), 'Marking the project completed');
    }
    if (developer) await grantDeveloper(db, project.id, developer.id);
    created++;
  }
  log(`Loaded ${created} projects (existing ones were reused by request id).`);
  return {wrote: true, created};
}

// Developer = manager on every project with finance opened, set by Ben's session (A-06: access is Ben's to give).
export async function grantDeveloper(db, projectId, userId) {
  let m = await must(db.from('memberships').select('revision,finance_access').eq('project_id', projectId).eq('user_id', userId).maybeSingle(), 'Reading membership');
  if (!m) {
    await must(db.rpc('set_membership', {input: {userId, projectId, role: 'manager', expectedRevision: null}}), 'Adding the developer');
    m = await must(db.from('memberships').select('revision,finance_access').eq('project_id', projectId).eq('user_id', userId).single(), 'Reading membership');
  }
  if (!m.finance_access) await must(db.rpc('set_finance_access', {input: {userId, projectId, enabled: true, expectedRevision: m.revision}}), 'Opening finance for the developer');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  load({args: parseArgs(process.argv.slice(2)), env: process.env}).catch(err => { console.error(err.message); process.exit(1); });
}
