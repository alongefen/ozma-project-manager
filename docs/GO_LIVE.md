# Go-live runbook

Status: PREPARED, nothing has been run against the cloud. Project `izjmvyguzbampoasvnru` (Ireland) is the production database (A-40). Every step that writes needs Alon's direct "כן" in the session that runs it (D31). Never print, paste or commit a secret.

## Order

| # | Step | Who | Gate |
|---|---|---|---|
| a | Upgrade the Supabase project to Pro in the dashboard (Settings > Billing). Confirm in Database > Backups that a daily backup exists. Optionally take a manual backup right before step c. | Alon | Alon confirms in chat |
| b | Finish P3.1 (security) and the device tests on demo data. The cloud window is exclusive: no other session may write while c-e run. | PM | P3.1 reported done |
| c | Purge: dry run, read the counts, then the real run | task session + Alon | "כן" for the dry run, then "כן" for the purge |
| d | Owner (Ben) and developer account | task session + Alon | "כן" |
| e | Load the approved projects | task session + Alon | list approved, then "כן" |
| f | Smoke test per role | task session | none |
| g | Rollback, only if needed | Alon | see below |

Vercel can go live before all of this (Alon's decision 24.11.2026), pointing at the same project.

## Environment (names only, values live in Vercel and in Alon's local env file)

| Name | Used by | Where |
|---|---|---|
| `SUPABASE_URL` | app and scripts | Vercel + local |
| `SUPABASE_PUBLISHABLE_KEY` | app and seed/load scripts | Vercel + local |
| `SUPABASE_SECRET_KEY` | app (server only) and scripts | Vercel (server) + local |
| `SUPABASE_ACCESS_TOKEN` | purge script only: a Supabase personal access token, created by Alon in the dashboard, deleted after go-live | local only, never Vercel |
| `GO_LIVE_OWNER_PASSWORD` | load script only: Ben's one-time password, pasted by Alon for that one command | local shell only |
| `REPORT_CHROME_PATH`, `VERCEL`, `NODE_ENV` | PDF rendering and runtime | set by the platform / optional |

Node 24 (`engines`: `>=24 <25`). Set the Vercel project's Node version to 24.x. Scripts run with `node --env-file=<file>` so secrets are never typed in the command line.

## c. Purge

What it deletes: every row in the 19 application tables listed in `scripts/ops/purge-demo.mjs` (`TABLES`), every object in storage, every auth user. What it keeps: schema, migrations, functions, policies, enum types, buckets. There is no other reference data to keep (the categories are enum types).

Diary versions, entries, transactions, files and the action log are protected by immutability triggers ("nothing is physically deleted"). For demo data this is the single approved exception: the purge SQL disables exactly those seven triggers inside its own all-or-nothing transaction and re-enables them at its end (the Management API role may not use `session_replication_role`, but it owns the tables). The run verifies afterwards that all triggers are on again. Nothing else in the system ever does this.

```bash
# 1. dry run (read-only): counts per table, storage objects, accounts (non-demo emails masked)
node --env-file=<env> scripts/ops/purge-demo.mjs
# 2. real run, only after "כן"; the total comes from the dry run
node --env-file=<env> scripts/ops/purge-demo.mjs --confirm --project-ref=izjmvyguzbampoasvnru --expect-total=<total>
```

The real run refuses when any non-demo login exists (a guard against running it after go-live) unless `--include-real-users` is added, which Alon uses only if his own demo login is not `@example.invalid`. Order inside the real run: storage objects, then one all-or-nothing SQL request, then auth users, then a verification that everything is empty. A failed run is safe to repeat (every step is a delete of what is still there). `--expect-total` (printed by the dry run as `expectTotal`) fails the run if data changed since the dry run, for example a test session still writing.

## d. Accounts

```bash
node --env-file=<env> scripts/ops/seed-accounts.mjs --owner-email=<ben> --owner-name=<name> --developer-email=<alon>            # dry run
node --env-file=<env> scripts/ops/seed-accounts.mjs --owner-email=... --owner-name=... --developer-email=... --confirm --project-ref=izjmvyguzbampoasvnru
```

Ben becomes the first owner through `system_bootstrap_owner` (works only while no owner exists). The developer account (<alon>) is added as a second owner-level ("אדמין") account through `system_add_owner`, a service-role function. Each one-time password is printed once to the terminal right after its login is created (so a half-finished run never loses one); Alon hands Ben's over himself and keeps his own. Neither is stored. The script never overwrites an existing login; if a run stops half way, nothing real exists yet, so run the purge again and repeat.

The developer is a visible owner-level account named `Alon (Developer & Support)` (A-43). Any owner can deactivate or demote another owner; the last owner cannot be removed. It needs no membership: an owner sees every project.

## e. Project load

```bash
node scripts/import/extract-website-projects.mjs                       # public pages only -> scripts/import/out/projects.local.json (git-ignored)
node --env-file=<env> scripts/import/load-projects.mjs --owner-email=<ben>    # dry run
GO_LIVE_OWNER_PASSWORD=<pasted by Alon> node --env-file=<env> scripts/import/load-projects.mjs --owner-email=... --confirm --project-ref=izjmvyguzbampoasvnru
```

Alon approves the list first. Rows are created with `create_project` as Ben, with a fixed request id each, so a retry reuses them. Finished projects are marked completed; "coming soon" stay active. See [DATA_IMPORT](DATA_IMPORT.md).

## f. Smoke test per role

Sign in on the live URL as Ben, as the developer, and (with a fake account Ben creates and then deactivates) as a worker: Ben and the developer each see all projects, finance and the people list (both owner-level accounts); the worker sees only assigned projects and no finance. Create and cancel one diary entry on a throwaway active project only if Ben agrees; otherwise verify read-only.

## g. Rollback

- Before the purge: Pro daily backup, plus a manual backup right before. Restoring a backup replaces the whole database and is done by Alon in the dashboard (Database > Backups). Auth users and storage objects deleted by the purge are part of the project backup only for the database and auth schema; storage files are NOT restored by a database restore. Demo files are fake, so this is accepted.
- After the load: the load is idempotent. To undo it, restore the backup or run the purge again (nothing real exists until the first real user report).
- After real data exists: the purge scripts must never be run again. Use the backup restore only.
