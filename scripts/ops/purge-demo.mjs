#!/usr/bin/env node
// Purges ALL demo/test data (see docs/GO_LIVE.md). Dry run by default: read-only, prints counts only.
//   node --env-file=<env> scripts/ops/purge-demo.mjs
//   node --env-file=<env> scripts/ops/purge-demo.mjs --confirm --project-ref=<ref> --expect-total=<n from dry run>
// Env: SUPABASE_URL, SUPABASE_SECRET_KEY (storage + auth users), SUPABASE_ACCESS_TOKEN (SQL via Management API).
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {createSqlRunner, maskEmail, parseArgs, requireEnv, resolveMode} from './lib.mjs';

// Child tables first. Reference data (enums, schema, functions, policies, migrations) is not listed: it is never touched.
export const TABLES = [
  'public.diary_version_files', 'public.diary_versions', 'public.diary_attachments', 'public.diary_entries',
  'public.document_grants', 'public.documents', 'public.project_covers', 'public.stored_files', 'public.tasks',
  'public.transactions', 'public.sensitive_events', 'public.project_finance_settings', 'public.project_private',
  'public.project_contacts', 'public.memberships', 'public.projects',
  'private.profile_creation_requests', 'private.profile_updates', 'public.profiles',
];
export const DEMO_DOMAIN = '@example.invalid';
const BATCH = 100;

// Safety net: if the purge request fails half way, switch every protection trigger back on before rethrowing.
export const PROTECTED = [['diary_versions', 'immutable_diary_versions'], ['diary_version_files', 'immutable_diary_version_files'], ['diary_attachments', 'immutable_diary_attachments'], ['sensitive_events', 'immutable_sensitive_events'], ['diary_entries', 'immutable_diary_entries'], ['stored_files', 'immutable_stored_files'], ['transactions', 'immutable_transactions']];
export const enableTriggersSql = () => PROTECTED.map(([t, g]) => `alter table public.${t} enable trigger ${g};`).join('\n');
export const countSql = () => TABLES.map(t => `select '${t}' as t, count(*)::int as n from ${t}`).join(' union all ');
// Every storage object (documents, display copies and orphans): the app owns all of them.
export const filesSql = () => 'select bucket_id as bucket, name as path from storage.objects';
// Read-only probe: does the role own the 7 protected tables (so it may disable their triggers), and are all triggers on?
export const probeSql = () => "select current_user as who, (select bool_and(pg_has_role(current_user,tableowner,'member')) from pg_tables where schemaname='public' and tablename in ('diary_versions','diary_version_files','diary_attachments','sensitive_events','diary_entries','stored_files','transactions')) as can_alter_triggers, (select count(*)::int from pg_trigger where tgname like 'immutable\\_%' and tgenabled<>'O') as triggers_not_enabled";

export function summarize({counts, files, users}) {
  const demo = users.filter(u => (u.email ?? '').toLowerCase().endsWith(DEMO_DOMAIN));
  const other = users.filter(u => !demo.includes(u));
  const rowTotal = Object.values(counts).reduce((a, b) => a + b, 0);
  return {counts, rowTotal, storageObjects: files.length, authUsers: users.length, demoUsers: demo.length, otherUsers: other.map(u => maskEmail(u.email ?? '?'))};
}

export function expectedTotal(summary) { return summary.rowTotal + summary.storageObjects + summary.authUsers; }

export async function listAuthUsers(admin) {
  const users = [];
  for (let page = 1; ; page++) {
    const {data, error} = await admin.auth.admin.listUsers({page, perPage: 1000});
    if (error) throw new Error('Listing auth users failed');
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

export async function collect({sql, admin}) {
  const rows = await sql(countSql());
  const counts = Object.fromEntries(rows.map(r => [r.t, r.n]));
  const files = await sql(filesSql());
  const users = await listAuthUsers(admin);
  return {counts, files, users};
}

export async function removeStorage(admin, files) {
  const byBucket = new Map();
  for (const f of files) {
    const paths = byBucket.get(f.bucket) ?? [];
    paths.push(f.path);
    byBucket.set(f.bucket, paths);
  }
  for (const [bucket, paths] of byBucket) {
    for (let i = 0; i < paths.length; i += BATCH) {
      const {error} = await admin.storage.from(bucket).remove(paths.slice(i, i + BATCH));
      if (error) throw new Error(`Storage removal failed in bucket ${bucket}`);
    }
  }
}

export async function removeAuthUsers(admin, users) {
  for (const u of users) {
    const {error} = await admin.auth.admin.deleteUser(u.id);
    if (error) throw new Error('Deleting an auth user failed; re-run the purge, it is idempotent');
  }
}

export async function run({args, env, log = console.log, sqlText = readFileSync(fileURLToPath(new URL('./purge-demo.sql', import.meta.url)), 'utf8'), clients}) {
  const mode = resolveMode(args, env);
  const e = requireEnv(env, ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_ACCESS_TOKEN']);
  const admin = clients?.admin ?? createClient(e.SUPABASE_URL, e.SUPABASE_SECRET_KEY, {auth: {persistSession: false, autoRefreshToken: false}});
  const sql = clients?.sql ?? createSqlRunner({token: e.SUPABASE_ACCESS_TOKEN});
  const before = summarize(await collect({sql, admin}));
  const privilege = (await sql(probeSql()))[0];
  log(JSON.stringify({mode: mode.write ? 'REAL RUN' : 'DRY RUN', ...before, expectTotal: expectedTotal(before), privilege}, null, 2));
  if (!mode.write) { log('Dry run only. Nothing was changed.'); return {wrote: false, before}; }
  // Guard against running after go-live: any non-demo login or any real owner blocks the run unless explicitly overridden.
  if (before.otherUsers.length > 0 && args['include-real-users'] !== true) throw new Error(`Refusing: ${before.otherUsers.length} non-demo login(s) exist. If these are demo logins you made yourself, add --include-real-users`);
  if (!privilege.can_alter_triggers || privilege.triggers_not_enabled !== 0) throw new Error('Refusing: the SQL role cannot manage the protection triggers, or some are already off (see privilege in the output)');
  const total = expectedTotal(before);
  if (String(args['expect-total']) !== String(total)) throw new Error(`--expect-total must equal the dry-run total (${total}); the data changed or the flag is missing`);
  const {files, users} = await collect({sql, admin});
  await removeStorage(admin, files);                // 1. storage objects (needs the file list that the SQL step erases)
  try { await sql(sqlText); } catch (err) {          // 2. database rows, one transaction
    await sql(enableTriggersSql()).catch(() => {});
    throw new Error(`Purge SQL failed (${err.message}); protection triggers were re-enabled. Nothing is half-deleted if the request was atomic; check with a dry run.`);
  }
  await removeAuthUsers(admin, users);               // 3. auth users (profiles reference them, so after step 2)
  const after = summarize(await collect({sql, admin}));
  if ((await sql(probeSql()))[0].triggers_not_enabled !== 0) throw new Error('CRITICAL: protection triggers are not enabled after the purge; re-enable them (see purge-demo.sql)');
  if (after.rowTotal !== 0 || after.authUsers !== 0 || after.storageObjects !== 0) throw new Error('Verification failed: data remains. Re-run the purge (idempotent).');
  log('Purge complete and verified: all tables and auth users are empty.');
  return {wrote: true, before, after};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run({args: parseArgs(process.argv.slice(2)), env: process.env}).catch(err => { console.error(err.message); process.exit(1); });
}
