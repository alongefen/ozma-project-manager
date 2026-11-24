#!/usr/bin/env node
// Removes ONLY what scripts/demo/out/ledger.local.json lists (the demo projects, rows, files and logins). Dry run by default.
//   node --env-file=<env> scripts/demo/remove-demo.mjs
//   node --env-file=<env> scripts/demo/remove-demo.mjs --confirm --project-ref=<ref> --expect-total=<n from the dry run>
// Env: SUPABASE_URL, SUPABASE_SECRET_KEY (storage + logins), SUPABASE_ACCESS_TOKEN (SQL via the Management API).
//
// This is a SECOND approved exception to "nothing is physically deleted": the seven protection triggers are switched off
// inside ONE transaction (same approach and same trigger list as scripts/ops/purge-demo.mjs) and switched back on at its end;
// a failure rolls back the switch-off too, and a second safety net re-enables them. Rows of real projects are never touched.
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {createSqlRunner, PROJECT_REF, parseArgs, requireEnv, resolveMode} from '../ops/lib.mjs';
import {PROTECTED, enableTriggersSql, probeSql, removeStorage} from '../ops/purge-demo.mjs';
import {LEDGER_PATH, archiveLedger, ledgerCounts, loadLedger} from './ledger.mjs';
import {DEMO_DOMAIN, NAME_PREFIX} from './plan.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const lit = list => { for (const x of list) if (!UUID.test(String(x))) throw new Error('The ledger holds a value that is not a uuid; refusing'); return list.length ? `array[${list.map(x => `'${x}'`).join(',')}]::uuid[]` : "array[]::uuid[]"; };
const idsOf = (ledger, k) => ledger[k].map(x => x.id);

export function scope(ledger) {
  return {P: lit(idsOf(ledger, 'projects')), U: lit(idsOf(ledger, 'profiles')), E: lit(idsOf(ledger, 'diaryEntries')), D: lit(idsOf(ledger, 'documents')), T: lit(idsOf(ledger, 'tasks')), X: lit(idsOf(ledger, 'transactions')), F: lit(idsOf(ledger, 'storedFiles'))};
}

// Rows that exist now, per table, restricted to what the ledger lists (read-only).
export function presentSql(ledger) {
  const s = scope(ledger);
  const q = (t, where) => `select '${t}' as t, count(*)::int as n from ${t} where ${where}`;
  return [
    q('public.projects', `id = any(${s.P})`), q('public.project_contacts', `project_id = any(${s.P})`), q('public.project_private', `project_id = any(${s.P})`),
    q('public.project_finance_settings', `project_id = any(${s.P})`), q('public.memberships', `project_id = any(${s.P})`),
    q('public.project_covers', `project_id = any(${s.P})`), q('public.stored_files', `project_id = any(${s.P})`),
    q('public.documents', `project_id = any(${s.P})`), q('public.document_grants', `project_id = any(${s.P})`),
    q('public.diary_entries', `project_id = any(${s.P})`), q('public.diary_versions', `entry_id = any(${s.E})`),
    q('public.diary_attachments', `entry_id = any(${s.E})`), q('public.diary_version_files', `entry_id = any(${s.E})`),
    q('public.tasks', `project_id = any(${s.P})`), q('public.transactions', `project_id = any(${s.P})`),
    q('public.sensitive_events', `project_id = any(${s.P}) or actor_id = any(${s.U}) or (entity_type = 'profile' and entity_id = any(${s.U}::text[]))`),
    q('public.profiles', `id = any(${s.U})`), q('private.profile_creation_requests', `user_id = any(${s.U})`), q('private.profile_updates', `user_id = any(${s.U})`),
  ].join(' union all ');
}

// Anything the ledger does not list but that touches a ledger project or a demo login: a real person added it.
export function foreignSql(ledger) {
  const s = scope(ledger);
  const q = (label, from, where) => `select '${label}' as t, count(*)::int as n from ${from} where ${where}`;
  return [
    q('diary_entries in a demo project', 'public.diary_entries', `project_id = any(${s.P}) and id <> all(${s.E})`),
    q('diary_entries by a demo login', 'public.diary_entries', `reporter_id = any(${s.U}) and id <> all(${s.E})`),
    q('tasks', 'public.tasks', `(project_id = any(${s.P}) or created_by = any(${s.U})) and id <> all(${s.T})`),
    q('transactions', 'public.transactions', `(project_id = any(${s.P}) or created_by = any(${s.U})) and id <> all(${s.X})`),
    q('documents', 'public.documents', `(project_id = any(${s.P}) or uploaded_by = any(${s.U})) and id <> all(${s.D})`),
    q('stored_files', 'public.stored_files', `(project_id = any(${s.P}) or uploaded_by = any(${s.U})) and id <> all(${s.F})`),
    q('memberships of other people', 'public.memberships', `project_id = any(${s.P}) and user_id <> all(${s.U})`),
    q('memberships of demo logins elsewhere', 'public.memberships', `user_id = any(${s.U}) and project_id <> all(${s.P})`),
    q('listed entries outside the demo projects', 'public.diary_entries', `id = any(${s.E}) and project_id <> all(${s.P})`),
    q('listed documents outside the demo projects', 'public.documents', `id = any(${s.D}) and project_id <> all(${s.P})`),
    q('listed tasks outside the demo projects', 'public.tasks', `id = any(${s.T}) and project_id <> all(${s.P})`),
    q('listed transactions outside the demo projects', 'public.transactions', `id = any(${s.X}) and project_id <> all(${s.P})`),
    q('listed files outside the demo projects', 'public.stored_files', `id = any(${s.F}) and project_id <> all(${s.P})`),
    q('projects created by a demo login', 'public.projects', `created_by = any(${s.U}) and id <> all(${s.P})`),
    q('ledger projects that are not demo-named', 'public.projects', `id = any(${s.P}) and name not like '${NAME_PREFIX}%'`),
    q('ledger logins that are not demo accounts', 'public.profiles', `id = any(${s.U}) and email not like '%${DEMO_DOMAIN}'`),
  ].join(' union all ');
}

export function removalSql(ledger) {
  const s = scope(ledger);
  return [
    'begin;',
    ...PROTECTED.map(([t, g]) => `alter table public.${t} disable trigger ${g};`),
    `delete from public.diary_version_files where entry_id = any(${s.E});`,
    `delete from public.diary_versions where entry_id = any(${s.E});`,
    `delete from public.diary_attachments where entry_id = any(${s.E});`,
    `delete from public.diary_entries where id = any(${s.E});`,
    `delete from public.document_grants where project_id = any(${s.P});`,
    `delete from public.documents where id = any(${s.D});`,
    `delete from public.project_covers where project_id = any(${s.P});`,
    `delete from public.stored_files where id = any(${s.F});`,
    `delete from public.tasks where id = any(${s.T});`,
    `delete from public.transactions where id = any(${s.X});`,
    `delete from public.sensitive_events where project_id = any(${s.P}) or actor_id = any(${s.U}) or (entity_type = 'profile' and entity_id = any(${s.U}::text[]));`,
    `delete from public.project_finance_settings where project_id = any(${s.P});`,
    `delete from public.project_private where project_id = any(${s.P});`,
    `delete from public.project_contacts where project_id = any(${s.P});`,
    `delete from public.memberships where project_id = any(${s.P}) and user_id = any(${s.U});`,
    `delete from public.projects where id = any(${s.P});`,
    `delete from private.profile_creation_requests where user_id = any(${s.U});`,
    `delete from private.profile_updates where user_id = any(${s.U});`,
    `delete from public.profiles where id = any(${s.U});`,
    ...PROTECTED.map(([t, g]) => `alter table public.${t} enable trigger ${g};`),
    'commit;',
  ].join('\n');
}

export const presentQuery = presentSql;
export const removalScript = removalSql;

export async function removeAuthUsers(admin, authUsers) {
  for (const u of authUsers) {
    const found = await admin.auth.admin.getUserById(u.id);
    if (found.error || !found.data?.user) continue; // already gone: idempotent
    if (!String(found.data.user.email ?? '').toLowerCase().endsWith(DEMO_DOMAIN)) throw new Error('Refusing: a ledger login is not a demo account');
    const {error} = await admin.auth.admin.deleteUser(u.id);
    if (error) throw new Error('Deleting a demo login failed; re-run the removal, it is idempotent');
  }
}

// Every listed storage object must live under a ledger project id in one of the app's two buckets.
export function checkStoragePaths(ledger) {
  const projects = new Set(idsOf(ledger, 'projects'));
  for (const o of ledger.storage) if (!['originals', 'display'].includes(o.bucket) || !projects.has(String(o.path).split('/')[0])) throw new Error('Refusing: a storage path in the ledger is not under a demo project');
}

const total = rows => rows.reduce((a, r) => a + r.n, 0);
const projectCount = async sql => (await sql('select count(*)::int as n from public.projects'))[0].n;

export async function run({args, env, log = console.log, clients = /** @type {any} */ (undefined), ledgerIO = /** @type {any} */ (undefined), ref = PROJECT_REF}) {
  const mode = resolveMode(args, env, ref);
  const e = requireEnv(env, ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_ACCESS_TOKEN']);
  const io = ledgerIO ?? {load: () => loadLedger(LEDGER_PATH, ref), archive: l => archiveLedger(l, LEDGER_PATH)};
  const ledger = io.load();
  if (!ledger.projects.length && !ledger.profiles.length && !ledger.authUsers.length) throw new Error('The ledger is empty: there is nothing to remove');
  const admin = clients?.admin ?? createClient(e.SUPABASE_URL, e.SUPABASE_SECRET_KEY, {auth: {persistSession: false, autoRefreshToken: false}});
  const sql = clients?.sql ?? createSqlRunner({token: e.SUPABASE_ACCESS_TOKEN});
  checkStoragePaths(ledger);
  const present = await sql(presentQuery(ledger));
  const foreign = (await sql(foreignSql(ledger))).filter(r => r.n > 0);
  const privilege = (await sql(probeSql()))[0];
  const expectTotal = total(present) + ledger.storage.length + ledger.authUsers.length;
  log(JSON.stringify({mode: mode.write ? 'REAL RUN' : 'DRY RUN', ledger: ledgerCounts(ledger), rowsPresent: Object.fromEntries(present.map(r => [r.t, r.n])), rowTotal: total(present), storageObjects: ledger.storage.length, authUsers: ledger.authUsers.length, expectTotal, foreignRows: foreign, privilege}, null, 2));
  if (!mode.write) { log('Dry run only. Nothing was changed.'); return {wrote: false, expectTotal, foreign}; }
  if (foreign.length) throw new Error(`Refusing: rows exist that the demo did not create (${foreign.map(f => `${f.t}: ${f.n}`).join(', ')}). Nothing was changed; ask the project manager.`);
  if (!privilege.can_alter_triggers || privilege.triggers_not_enabled !== 0) throw new Error('Refusing: the SQL role cannot manage the protection triggers, or some are already off (see privilege in the output)');
  if (String(args['expect-total']) !== String(expectTotal)) throw new Error(`--expect-total must equal the dry-run total (${expectTotal}); the data changed or the flag is missing`);
  const projectsBefore = await projectCount(sql);
  await removeStorage(admin, ledger.storage);                    // 1. the demo's files only (ledger paths)
  try { await sql(removalScript(ledger)); } catch (err) {          // 2. database rows, one transaction
    await sql(enableTriggersSql()).catch(() => {});
    throw new Error(`Removal SQL failed (${err.message}); protection triggers were re-enabled. Nothing is half-deleted if the request was atomic; check with a dry run.`);
  }
  await removeAuthUsers(admin, ledger.authUsers);                // 3. demo logins (profiles reference them, so after step 2)
  const after = await sql(presentQuery(ledger));
  if ((await sql(probeSql()))[0].triggers_not_enabled !== 0) throw new Error('CRITICAL: protection triggers are not enabled after the removal; re-enable them (see enableTriggersSql in scripts/ops/purge-demo.mjs)');
  if (total(after) !== 0) throw new Error('Verification failed: demo rows remain. Re-run the removal (idempotent).');
  const projectsAfter = await projectCount(sql);
  const demoProjects = present.find(r => r.t === 'public.projects')?.n ?? 0;
  if (projectsBefore - demoProjects !== projectsAfter) throw new Error('Verification failed: the project count changed by more than the demo projects');
  io.archive({...ledger, removedAt: new Date().toISOString()}); // moves the ledger aside, so a later seed starts clean
  log(`Removal complete and verified. Real projects left untouched: ${projectsAfter}.`);
  return {wrote: true, projectsBefore, projectsAfter};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run({args: parseArgs(process.argv.slice(2)), env: process.env}).catch(err => { console.error(err.message); process.exit(1); });
}
