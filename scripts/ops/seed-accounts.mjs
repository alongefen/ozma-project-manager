#!/usr/bin/env node
// Creates the client's owner (Ben) and the visible developer/support account.
//   node --env-file=<env> scripts/ops/seed-accounts.mjs --owner-email=<ben> --owner-name=<name> --developer-email=<alon> [--dry-run default]
//   add: --confirm --project-ref=<ref>   for a real run
// Env: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY.
// One-time passwords are generated here, printed ONCE to the terminal, and never written anywhere.
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {generatePassword, parseArgs, requireEnv, resolveMode, stableUuid} from './lib.mjs';

export const DEVELOPER_NAME = 'Alon (Developer & Support)';
const noSession = {auth: {persistSession: false, autoRefreshToken: false}};
const emailOk = v => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export function validate(args) {
  const ownerEmail = String(args['owner-email'] ?? '').trim().toLowerCase();
  const developerEmail = String(args['developer-email'] ?? '').trim().toLowerCase();
  if (!emailOk(ownerEmail) || !emailOk(developerEmail)) throw new Error('--owner-email and --developer-email must be valid emails');
  if (ownerEmail === developerEmail) throw new Error('Owner and developer must be different accounts');
  if (ownerEmail.endsWith('@example.invalid') || developerEmail.endsWith('@example.invalid')) throw new Error('example.invalid is the demo domain');
  const ownerName = String(args['owner-name'] ?? '').trim();
  if (!ownerName) throw new Error('--owner-name is required (Ben\'s display name)');
  return {ownerEmail, developerEmail, ownerName, developerName: String(args['developer-name'] ?? DEVELOPER_NAME).trim()};
}

async function must(promise, what) {
  const {data, error} = await promise;
  if (error) throw new Error(`${what} failed (${error.code ?? error.message ?? 'error'})`);
  return data;
}

export async function seed({args, env, log = console.log, print = console.log, clients}) {
  const mode = resolveMode(args, env);
  const input = validate(args);
  const e = requireEnv(env, ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY']);
  log(JSON.stringify({mode: mode.write ? 'REAL RUN' : 'DRY RUN', willCreate: ['owner (Ben)', 'developer/support account (manager role + finance on every project, visible in the people list)']}, null, 2));
  if (!mode.write) { log('Dry run only. Nothing was changed.'); return {wrote: false}; }
  const admin = clients?.admin ?? createClient(e.SUPABASE_URL, e.SUPABASE_SECRET_KEY, noSession);
  const pub = clients?.pub ?? createClient(e.SUPABASE_URL, e.SUPABASE_PUBLISHABLE_KEY, noSession);
  const ownerPassword = generatePassword();
  const developerPassword = generatePassword();

  // 1. Owner: system_bootstrap_owner works only while no owner exists (ARCHITECTURE 4.2 "הקמת בן").
  const showOnce = (who, email, pw) => print(`ONE-TIME PASSWORD (shown once, not stored) ${who} ${email}  ${pw}`);
  const ownerUser = await must(admin.auth.admin.createUser({email: input.ownerEmail, password: ownerPassword, email_confirm: true}), 'Creating the owner login');
  showOnce('owner', input.ownerEmail, ownerPassword);
  await must(admin.rpc('system_bootstrap_owner', {input: {userId: ownerUser.user.id, fullName: input.ownerName}}), 'Bootstrapping the owner (an owner may already exist)');

  // 2. Developer: the same path the app uses for "create person", executed with Ben's own session.
  const signed = await must(pub.auth.signInWithPassword({email: input.ownerEmail, password: ownerPassword}), 'Signing in as the owner');
  void signed;
  const requestId = stableUuid(`developer:${input.developerEmail}`);
  const devUser = await must(admin.auth.admin.createUser({email: input.developerEmail, password: developerPassword, email_confirm: true}), 'Creating the developer login');
  showOnce('developer', input.developerEmail, developerPassword);
  await must(pub.rpc('create_profile', {input: {requestId, email: input.developerEmail, fullName: input.developerName}}), 'Creating the developer profile');
  await must(pub.rpc('complete_profile_creation', {input: {requestId, userId: devUser.user.id}}), 'Completing the developer profile');

  return {wrote: true, ownerId: ownerUser.user.id, developerId: devUser.user.id};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed({args: parseArgs(process.argv.slice(2)), env: process.env}).catch(err => { console.error(err.message); process.exit(1); });
}
