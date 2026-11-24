#!/usr/bin/env node
// Creates clearly marked FICTIONAL demo projects, people and content through the app's own database functions.
//   node --env-file=<env> scripts/demo/seed-demo.mjs --owner-email=<an owner>                    (dry run: prints counts, writes nothing)
//   add: --confirm --project-ref=<ref>   and set GO_LIVE_OWNER_PASSWORD in the environment for the real run
// Env: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY (+ GO_LIVE_OWNER_PASSWORD for a real run).
// Everything created is recorded in scripts/demo/out/ledger.local.json (git-ignored); remove-demo.mjs deletes only that.
// Each item has a fixed request id and a ledger step, so a retry never duplicates. Passwords are printed once, never stored.
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {generatePassword, PROJECT_REF, parseArgs, requireEnv, resolveMode, stableUuid} from '../ops/lib.mjs';
import {makeFile} from './assets.mjs';
import {LEDGER_PATH, ledgerCounts, loadLedger, record, saveLedger} from './ledger.mjs';
import {buildPlan, countPlan, txDate} from './plan.mjs';

const noSession = {auth: {persistSession: false, autoRefreshToken: false}};

async function must(promise, what) {
  const {data, error} = await promise;
  if (error) throw new Error(`${what} failed (${error.message ?? error.code ?? 'error'})`);
  return data;
}

export function sessionIdOf(accessToken) {
  const payload = JSON.parse(Buffer.from(String(accessToken).split('.')[1] ?? '', 'base64url').toString('utf8'));
  if (!payload.session_id) throw new Error('The sign-in carries no session id');
  return payload.session_id;
}

export function dryReport(plan) {
  return {willCreate: countPlan(plan), demoLogins: plan.people.map(p => ({name: p.name, role: p.kind, email: p.email})), projects: plan.projects.map(p => ({name: p.fields.name, status: p.status, members: p.members.length, diary: p.diary.length, documents: p.docs.length, tasks: p.tasks.length, transactions: p.txs.length}))};
}

export function defaultClients(env) {
  const e = requireEnv(env, ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY']);
  return {
    admin: createClient(e.SUPABASE_URL, e.SUPABASE_SECRET_KEY, noSession),
    async signIn(email, password) {
      const db = createClient(e.SUPABASE_URL, e.SUPABASE_PUBLISHABLE_KEY, noSession);
      const data = await must(db.auth.signInWithPassword({email, password}), `Signing in as ${email}`);
      return {db, userId: data.user.id, sessionId: sessionIdOf(data.session.access_token)};
    },
  };
}

export async function seed({args, env, log = console.log, print = console.log, clients = /** @type {any} */ (undefined), plan = buildPlan(), ledgerIO = /** @type {any} */ (undefined), files = makeFile, ref = PROJECT_REF}) {
  const mode = resolveMode(args, env, ref);
  log(JSON.stringify({mode: mode.write ? 'REAL RUN' : 'DRY RUN', ...dryReport(plan)}, null, 2));
  if (!mode.write) { log('Dry run only. Nothing was changed.'); return {wrote: false, plan}; }
  const e = requireEnv(env, ['GO_LIVE_OWNER_PASSWORD']);
  const ownerEmail = String(args['owner-email'] ?? '').trim().toLowerCase();
  if (!ownerEmail || ownerEmail.endsWith('@example.invalid')) throw new Error('--owner-email must be the email of a real owner account');
  const c = clients ?? defaultClients(env);
  const io = ledgerIO ?? {load: () => loadLedger(LEDGER_PATH, ref), save: l => saveLedger(l, LEDGER_PATH)};
  const ledger = io.load();
  const save = () => io.save(ledger);
  const step = async (key, fn) => {
    if (ledger.steps[key] !== undefined) return ledger.steps[key];
    const value = await fn();
    ledger.steps[key] = value ?? true; save();
    return ledger.steps[key];
  };

  const owner = await c.signIn(ownerEmail, e.GO_LIVE_OWNER_PASSWORD);
  const passwords = {};
  const users = {owner}; // key -> {db, userId, sessionId}
  const ids = {people: {}, projects: {}};

  // 1. Demo logins: auth user + profile through the owner's own functions. New one-time passwords every run (printed once).
  for (const p of plan.people) {
    passwords[p.key] = generatePassword();
    let authId = ledger.authUsers.find(u => u.email === p.email)?.id;
    if (authId) await must(c.admin.auth.admin.updateUserById(authId, {password: passwords[p.key]}), `Setting the password of ${p.email}`);
    else {
      const created = await must(c.admin.auth.admin.createUser({email: p.email, password: passwords[p.key], email_confirm: true}), `Creating the login ${p.email}`);
      authId = created.user.id;
      record(ledger, 'authUsers', {id: authId, email: p.email}); save();
    }
    const saved = await must(owner.db.rpc('create_profile', {input: {requestId: p.requestId, email: p.email, fullName: p.name}}), `Creating the profile ${p.email}`);
    record(ledger, 'profiles', {id: saved.id, email: p.email}); save();
    await must(owner.db.rpc('complete_profile_creation', {input: {requestId: p.requestId, userId: saved.id}}), `Completing the profile ${p.email}`);
    ids.people[p.key] = saved.id;
  }
  for (const p of plan.people) users[p.key] = await c.signIn(p.email, passwords[p.key]);
  const who = key => { const u = users[key]; if (!u) throw new Error(`Unknown actor ${key}`); return u; };

  // Upload one generated file as `actor` (begin_upload, storage, system_finish_upload). Every object is ledgered at once.
  async function upload(actor, projectId, purpose, fileName, kind, tone) {
    const made = await files(kind, {name: fileName, tone});
    const clientId = stableUuid(`demo:upload:${projectId}:${purpose}:${fileName}`);
    const [slot] = await must(actor.db.rpc('begin_upload', {input: {projectId, purpose, files: [{clientId, name: fileName, mime: made.mime, sizeBytes: made.bytes.length}]}}), `Starting the upload of ${fileName}`);
    record(ledger, 'storedFiles', {id: slot.fileId, projectId, bucket: slot.bucket, path: slot.path}); save();
    record(ledger, 'storage', {bucket: slot.bucket, path: slot.path}); save();
    const up = await c.admin.storage.from(slot.bucket).upload(slot.path, made.bytes, {contentType: made.mime, upsert: true});
    if (up.error) throw new Error(`Storing ${fileName} failed`);
    let displayState = made.display ? 'ready' : 'none'; let displayPath = null;
    if (made.display) {
      displayPath = `${projectId}/${slot.fileId}.jpg`;
      record(ledger, 'storage', {bucket: 'display', path: displayPath}); save();
      const d = await c.admin.storage.from('display').upload(displayPath, made.bytes, {contentType: 'image/jpeg', upsert: true});
      if (d.error) throw new Error(`Storing the display copy of ${fileName} failed`);
    }
    await must(c.admin.rpc('system_finish_upload', {input: {fileId: slot.fileId, actorId: actor.userId, sessionId: actor.sessionId, state: 'ready', mime: made.mime, sizeBytes: made.bytes.length, sha256: createHash('sha256').update(made.bytes).digest('hex'), displayState, displayPath}}), `Finishing the upload of ${fileName}`);
    return slot.fileId;
  }

  for (const proj of plan.projects) {
    // 2. Project
    const saved = await must(owner.db.rpc('create_project', {input: {requestId: plan.stableIds.project(proj), fields: proj.fields}}), `Creating ${proj.fields.name}`);
    ids.projects[proj.key] = saved.id;
    record(ledger, 'projects', {id: saved.id, name: proj.fields.name}); save();
    const pid = saved.id;

    // 3. Roles on the membership, and finance access for the chosen manager only
    for (const m of proj.members) {
      const userId = ids.people[m.user];
      await step(`membership:${proj.key}:${m.user}`, async () => {
        const existing = (await must(owner.db.from('memberships').select('revision').eq('project_id', pid).eq('user_id', userId), 'Reading memberships'))[0];
        const res = existing ? {revision: existing.revision} : await must(owner.db.rpc('set_membership', {input: {userId, projectId: pid, role: m.role, expectedRevision: null}}), `Adding ${m.user} to ${proj.key}`);
        record(ledger, 'memberships', {projectId: pid, userId});
        if (m.finance) await must(owner.db.rpc('set_finance_access', {input: {userId, projectId: pid, enabled: true, expectedRevision: res.revision}}), `Opening finance for ${m.user} on ${proj.key}`);
        return true;
      });
    }

    // 4. Cover picture
    await step(`cover:${proj.key}`, async () => {
      const fileId = await upload(owner, pid, 'cover', `${proj.key}-cover.jpg`, 'photo', plan.projects.indexOf(proj) + 2);
      const rev = (await must(owner.db.from('projects').select('revision').eq('id', pid).single(), 'Reading the project')).revision;
      await must(owner.db.rpc('set_project_cover', {input: {id: pid, expectedRevision: rev, fileId}}), 'Setting the cover');
      return fileId;
    });

    // 5. Diary reports, in different hands (a report is always written by its own author)
    for (const entry of proj.diary) {
      await step(`entry:${proj.key}:${entry.key}`, async () => {
        const actor = who(entry.by);
        const fileIds = [];
        for (const f of entry.files ?? []) fileIds.push(await upload(actor, pid, 'diary', f.name, f.kind, f.tone));
        const workDate = new Date(Date.parse(`${plan.today}T00:00:00Z`) - entry.ago * 86400000).toISOString().slice(0, 10);
        const made = await must(actor.db.rpc('create_entry', {input: {requestId: plan.stableIds.entry(proj, entry), projectId: pid, workDate, body: entry.body, fileIds}}), `Creating report ${entry.key}`);
        record(ledger, 'diaryEntries', {id: made.id}); save();
        if (entry.correctedBody) await must(actor.db.rpc('correct_entry', {input: {id: made.id, expectedRevision: made.revision, body: entry.correctedBody, fileIds}}), `Correcting report ${entry.key}`);
        return made.id;
      });
    }

    // 6. Documents
    for (const doc of proj.docs) {
      await step(`doc:${doc.key}`, async () => {
        const actor = who(doc.by);
        const fileId = await upload(actor, pid, 'document', doc.name, doc.kind, doc.tone);
        const access = doc.access.mode === 'selected' ? {mode: 'selected', userIds: doc.access.users.map(u => ids.people[u])} : {mode: doc.access.mode};
        const made = await must(actor.db.rpc('create_document', {input: {projectId: pid, fileId, category: doc.category, access}}), `Creating document ${doc.name}`);
        record(ledger, 'documents', {id: made.id}); save();
        return made.id;
      });
    }

    // 7. Tasks
    for (const t of proj.tasks) {
      await step(`task:${t.key}`, async () => {
        const made = await must(owner.db.rpc('create_task', {input: {requestId: plan.stableIds.task(t), projectId: pid, body: t.body, dueDate: t.due, completed: t.done}}), `Creating task ${t.key}`);
        record(ledger, 'tasks', {id: made.id}); save();
        return made.id;
      });
    }

    // 8. Finance rows: income, expenses, one cancelled, one corrected (all amounts are invented)
    for (const [i, t] of proj.txs.entries()) {
      await step(`tx:${proj.key}:${i}`, async () => {
        const by = t.by === 'cancel' || String(t.by).startsWith('fix:') ? 'owner' : t.by;
        const fields = (amount) => ({...txDate(new Date(`${plan.today}T00:00:00Z`), t.monthsAgo, t.day), kind: t.kind, amount, details: t.details});
        const made = await must(who(by).db.rpc('create_transaction', {input: {requestId: plan.stableIds.tx(proj, i), projectId: pid, fields: fields(t.amount)}}), `Creating transaction ${proj.key}#${i}`);
        record(ledger, 'transactions', {id: made.id}); save();
        // Read the live state first, so a retry after a crash never repeats an update or a cancel.
        const cur = await must(owner.db.from('transactions').select('revision,amount,cancelled_at').eq('id', made.id).single(), 'Reading the transaction');
        let revision = cur.revision;
        if (String(t.by).startsWith('fix:') && !cur.cancelled_at && cur.amount !== Number(t.by.slice(4)) * 100) {
          const fixed = await must(owner.db.rpc('update_transaction', {input: {id: made.id, expectedRevision: revision, fields: fields(Number(t.by.slice(4)) * 100)}}), 'Correcting a transaction');
          revision = fixed.revision;
        }
        if (t.by === 'cancel' && !cur.cancelled_at) await must(owner.db.rpc('cancel_transaction', {input: {id: made.id, expectedRevision: revision}}), 'Cancelling a transaction');
        return made.id;
      });
    }

    // 9. The finished project is closed last, so everything above could still be written
    if (proj.status === 'completed') {
      await step(`complete:${proj.key}`, async () => {
        const rev = (await must(owner.db.from('projects').select('revision').eq('id', pid).single(), 'Reading the project')).revision;
        await must(owner.db.rpc('set_project_status', {input: {id: pid, expectedRevision: rev, status: 'completed'}}), 'Marking the project completed');
        return true;
      });
    }
  }

  // Passwords: printed once, to the terminal only.
  for (const p of plan.people) print(`ONE-TIME PASSWORD (shown once, not stored) ${p.name} ${p.email}  ${passwords[p.key]}`);
  log(JSON.stringify({done: true, ledger: ledgerCounts(ledger), ledgerPath: LEDGER_PATH}, null, 2));
  return {wrote: true, ledger};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed({args: parseArgs(process.argv.slice(2)), env: process.env}).catch(err => { console.error(err.message); process.exit(1); });
}
