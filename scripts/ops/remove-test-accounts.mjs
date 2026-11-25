#!/usr/bin/env node
// Removes the fake TEST accounts that the HARD-DELETE cloud tests left in production on 25.11.2026 (and nothing else).
// Dry run by default (read-only). Real run needs Alon's direct yes in the task chat.
//   node --env-file=<env> scripts/ops/remove-test-accounts.mjs
//   node --env-file=<env> scripts/ops/remove-test-accounts.mjs --confirm --project-ref=<ref> --expect-total=<n from the dry run>
// Env: SUPABASE_URL, SUPABASE_SECRET_KEY (auth users), SUPABASE_ACCESS_TOKEN (SQL via the Management API).
//
// Dates are compared in the database time zone (UTC); an edge row is simply not selected (fails closed).
// Selection is by rule, not by "everything on @example.invalid": inactive, not an owner, @example.invalid, created on the test day,
// and one of the three exact test names. Demo accounts ("(דמו)"), owners and real people never match.
// Anything that still points at a selected account (membership, project, file, entry, task, transaction, document, a log row of another
// kind, a profile created by someone outside the set) makes the real run refuse. The only things deleted besides the accounts are their
// own audit rows (user.created, owner.created, user.active_changed, project.deleted) and their profile-creation request rows.
// Only the ONE protection trigger on sensitive_events is switched off, inside ONE transaction, and switched back on at its end.
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {createSqlRunner, maskEmail, parseArgs, PROJECT_REF, requireEnv, resolveMode} from './lib.mjs';
import {PROTECTED, enableTriggersSql, probeSql} from './purge-demo.mjs';

export const TEST_DAY = '2026-11-25';
export const TEST_NAMES = ['אדמין בדוי למחיקה%', 'בדיקה hdm%', 'בדיקה hdw%'];
export const ORPHAN_EMAILS = ['p12-owner-%@example.invalid', 'p12-hdm-%@example.invalid', 'p12-hdw-%@example.invalid', 'hd-owner-%@example.invalid'];
export const TEST_PROJECT_NAME = 'בדיקה hd-%';
export const LOG_ACTIONS = ['user.created', 'owner.created', 'user.active_changed', 'project.deleted'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const lit = ids => { for (const x of ids) if (!UUID.test(String(x))) throw new Error('A selected id is not a uuid; refusing'); return ids.length ? `array[${ids.map(x => `'${x}'`).join(',')}]::uuid[]` : 'array[]::uuid[]'; };

// Read-only selection. Returns rows {kind: 'profile'|'auth-only', id, email}.
export const selectSql = () => `
select 'profile' as kind, id::text, email from public.profiles
 where email like '%@example.invalid' and created_at::date = '${TEST_DAY}' and not is_active and not is_owner
 and (${TEST_NAMES.map(n => `full_name like '${n}'`).join(' or ')}) and full_name not like '%(דמו)%'
union all
select 'auth-only', u.id::text, u.email from auth.users u
 where (${ORPHAN_EMAILS.map(e => `u.email like '${e}'`).join(' or ')}) and u.created_at::date = '${TEST_DAY}' and not exists (select 1 from public.profiles p where p.id = u.id)`;

export function scopeOf(rows) {
  return {P: lit(rows.filter(r => r.kind === 'profile').map(r => r.id)), A: lit(rows.map(r => r.id))};
}

export function presentSql(rows) {
  const {P} = scopeOf(rows);
  const q = (t, where) => `select '${t}' as t, count(*)::int as n from ${t} where ${where}`;
  return [
    q('public.profiles', `id = any(${P})`),
    q('public.sensitive_events', `actor_id = any(${P}) or (entity_type = 'profile' and entity_id = any(${P}::text[]))`),
    q('private.profile_creation_requests', `user_id = any(${P}) or actor_id = any(${P})`),
    q('private.profile_updates', `user_id = any(${P}) or actor_id = any(${P})`),
  ].join(' union all ');
}

// Everything that would block the removal or that is not ours. Any n > 0 makes the real run refuse.
export function foreignSql(rows) {
  const {P} = scopeOf(rows);
  const q = (label, from, where) => `select '${label}' as t, count(*)::int as n from ${from} where ${where}`;
  const acts = LOG_ACTIONS.map(a => `'${a}'`).join(',');
  return [
    q('memberships', 'public.memberships', `user_id = any(${P})`),
    q('projects created', 'public.projects', `created_by = any(${P})`),
    q('stored files', 'public.stored_files', `uploaded_by = any(${P})`),
    q('documents', 'public.documents', `uploaded_by = any(${P})`),
    q('diary entries', 'public.diary_entries', `reporter_id = any(${P}) or cancelled_by = any(${P})`),
    q('diary versions', 'public.diary_versions', `editor_id = any(${P})`),
    q('tasks', 'public.tasks', `created_by = any(${P})`),
    q('transactions', 'public.transactions', `created_by = any(${P}) or updated_by = any(${P}) or cancelled_by = any(${P})`),
    q('project covers', 'public.project_covers', `created_by = any(${P})`),
    q('profiles created by a selected account but not selected', 'public.profiles', `created_by = any(${P}) and id <> all(${P})`),
    q('log rows of another kind', 'public.sensitive_events', `(actor_id = any(${P}) or (entity_type = 'profile' and entity_id = any(${P}::text[]))) and action <> all(array[${acts}])`),
    q('log rows with a project', 'public.sensitive_events', `(actor_id = any(${P}) or (entity_type = 'profile' and entity_id = any(${P}::text[]))) and project_id is not null`),
    q('log rows of a selected account about someone outside the set', 'public.sensitive_events', `actor_id = any(${P}) and entity_type = 'profile' and entity_id <> all(${P}::text[])`),
    q('project.deleted rows about a project that is not a test project', 'public.sensitive_events', `actor_id = any(${P}) and entity_type = 'project' and (action <> 'project.deleted' or coalesce(after->>'name', '') not like '${TEST_PROJECT_NAME}')`),
    q('log rows by someone outside the set about a selected account', 'public.sensitive_events', `entity_type = 'profile' and entity_id = any(${P}::text[]) and actor_id is not null and actor_id <> all(${P})`),
    q('request rows that also touch someone outside the set', 'private.profile_creation_requests', `(user_id = any(${P}) and actor_id <> all(${P})) or (actor_id = any(${P}) and user_id <> all(${P}))`),
    q('update rows that also touch someone outside the set', 'private.profile_updates', `(user_id = any(${P}) and actor_id <> all(${P})) or (actor_id = any(${P}) and user_id <> all(${P}))`),
  ].join(' union all ');
}

// One transaction; the single protection trigger that matters is off only inside it.
export function removalSql(rows) {
  const {P} = scopeOf(rows);
  return [
    'begin;',
    'alter table public.sensitive_events disable trigger immutable_sensitive_events;',
    `delete from public.sensitive_events where actor_id = any(${P}) or (entity_type = 'profile' and entity_id = any(${P}::text[]));`,
    'alter table public.sensitive_events enable trigger immutable_sensitive_events;',
    `delete from private.profile_creation_requests where user_id = any(${P}) or actor_id = any(${P});`,
    `delete from private.profile_updates where user_id = any(${P}) or actor_id = any(${P});`,
    `update public.profiles set created_by = null where id = any(${P});`,
    `delete from public.profiles where id = any(${P});`,
    'commit;',
  ].join('\n');
}

export async function removeAuthUsers(admin, rows) {
  for (const r of rows) {
    const found = await admin.auth.admin.getUserById(r.id);
    if (found.error || !found.data?.user) continue; // already gone: idempotent
    if (!String(found.data.user.email ?? '').toLowerCase().endsWith('@example.invalid')) throw new Error('Refusing: a selected login is not a test account');
    const {error} = await admin.auth.admin.deleteUser(r.id);
    if (error) throw new Error('Deleting a test login failed; re-run, it is idempotent');
  }
}

const sum = rs => rs.reduce((a, r) => a + r.n, 0);

export async function run({args, env, log = console.log, clients, ref = PROJECT_REF}) {
  const mode = resolveMode(args, env, ref);
  const e = requireEnv(env, ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_ACCESS_TOKEN']);
  const admin = clients?.admin ?? createClient(e.SUPABASE_URL, e.SUPABASE_SECRET_KEY, {auth: {persistSession: false, autoRefreshToken: false}});
  const sql = clients?.sql ?? createSqlRunner({token: e.SUPABASE_ACCESS_TOKEN});
  const rows = await sql(selectSql());
  const profiles = rows.filter(r => r.kind === 'profile');
  const present = await sql(presentSql(rows));
  const foreign = (await sql(foreignSql(rows))).filter(r => r.n > 0);
  const privilege = (await sql(probeSql()))[0];
  const expectTotal = sum(present) + rows.length;
  log(JSON.stringify({mode: mode.write ? 'REAL RUN' : 'DRY RUN', selected: {profiles: profiles.length, authOnly: rows.length - profiles.length}, accounts: rows.map(r => ({kind: r.kind, id: `${r.id.slice(0, 8)}…`, email: maskEmail(r.email)})), rowsPresent: Object.fromEntries(present.map(r => [r.t, r.n])), foreignRows: foreign, expectTotal, privilege}, null, 2));
  if (!mode.write) { log('Dry run only. Nothing was changed.'); return {wrote: false, expectTotal, foreign, rows}; }
  if (rows.length === 0) throw new Error('Nothing selected: nothing to remove');
  if (String(args['expect-accounts']) !== String(rows.length)) throw new Error(`--expect-accounts must equal the number of selected accounts (${rows.length})`);
  if (foreign.length) throw new Error(`Refusing: something else still points at these accounts (${foreign.map(f => `${f.t}: ${f.n}`).join(', ')}). Nothing was changed.`);
  if (!privilege.can_alter_triggers || privilege.triggers_not_enabled !== 0) throw new Error('Refusing: the SQL role cannot manage the protection triggers, or some are already off');
  if (String(args['expect-total']) !== String(expectTotal)) throw new Error(`--expect-total must equal the dry-run total (${expectTotal}); the data changed or the flag is missing`);
  try { await sql(removalSql(rows)); } catch (err) {
    await sql(enableTriggersSql()).catch(() => {});
    throw new Error(`Removal SQL failed (${err.message}); protection triggers were re-enabled and nothing is half-deleted if the request was atomic. Check with a dry run.`);
  }
  await removeAuthUsers(admin, rows); // profiles reference auth users, so after the SQL
  if ((await sql(probeSql()))[0].triggers_not_enabled !== 0) throw new Error('CRITICAL: protection triggers are not enabled after the removal; re-enable them');
  const left = await sql(selectSql());
  if (left.length !== 0 || sum(await sql(presentSql(rows))) !== 0) throw new Error('Verification failed: test accounts or their rows remain. Re-run (idempotent).');
  log('Removal complete and verified.');
  return {wrote: true};
}

export {PROTECTED};
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run({args: parseArgs(process.argv.slice(2)), env: process.env}).catch(err => { console.error(err.message); process.exit(1); });
}
