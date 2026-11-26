# Next session

## LEADS-FOUNDATION — construction management, 26.11.2026

Alon closed the screenshot-based scope, authorized necessary file edits on isolated branches without an allocation gate, and appointed chat `01a217e2-212a-7a72-a84d-2b0339c37e9a` the feature construction manager. [Final spec](tasks/LEADS-FOUNDATION.md), [plan](handoffs/LEADS-CONSTRUCTION.md). Worktree `/Users/alongefen/.codex/worktrees/leads-foundation/ozma-project-manager`, branch `codex/leads-foundation`. Refreshed origin/main: `6f87ea1`; incoming upload-toast changes inspected; no code tests run for management docs.

Dispatch two independent task chats: LEADS-DATA (contracts, additive SQL/rollback proposal, logic/local checks) and LEADS-ISOLATION (server production/Preview guard, local checks and read-only Preview readiness). No duplicate leads implementation chat found in current recent inventory/worktrees. UI waits for their committed interfaces; integration/cloud verification follows concrete D31 approval. Keep two task chats maximum. Use compact wait_threads snapshots on resumption, not polling loops. Required Sonnet reviewer is currently unavailable in exposed agent model options; do not silently substitute or call review passed.

Existing live DB, Preview only, no cloud writes in first dispatch. No auth-user/client-data changes, seed/reset, external integrations, auto-merge, main merge or production deployment. Alon's explicit feature-release approval remains required. Child tasks keep their own notes; this manager maintains shared docs. Next owner: DATA/ISOLATION task chats; manager resumes from their commits to prepare UI and present concrete D31 request.

## Working rule update — A-48, 26.11.2026

Alon requested fewer duplicate merge checks and immediate notification when a PR merges. Updated AGENTS.md, task brief template and PM brief: preserve valid evidence, inspect incoming changes before selecting reruns, batch docs before final CI, put late approval/results/SHA in the PR body rather than triggering another bookkeeping commit. Required CI remains mandatory; no workflow changes. Send merge link/SHA immediately after GitHub confirmation, then continue authorized deployment/main checks/sync and report their outcome separately. [Task](tasks/PM-MERGE-EFFICIENCY.md). Docs-only; no code tests required. Alon explicitly requested merging this instruction update to main.

25.11.2026. `origin/main`: `6d5b118`. Agent-facing doc, in English. Start here, then `git log --oneline -15` and `gh pr list`.

## State

- **The repo moved to the GitHub org `ozma-construction/ozma-project-manager`** (done by Alon). `gh` needs `--repo ozma-construction/ozma-project-manager` for PRs from this checkout; local `origin` still points at the old URL and redirects. Vercel (team `ozma`, Hobby, A-42) is live; production was serving the sign-in page on 24.11.2026. Whether Vercel can still build from the org repo on Hobby is **not verified**.
- **All screens P2.1-P2.8 and the polish rounds are merged** (UX-AUDIT #109/#112, selectors #92/#95, finance-all #104, users #105, documents/previews, print/export #90, skeletons #94, sticky headers #79, auto-upload #78, new-report fix #119, icons #118). Security: P3.1 (#116, `docs/qa/SECURITY.md`) and SECURITY-FIXES (#117: headers, pdf.js pin). Open finding: X17 login rate-limit probe not run; `pdfjs-dist` 6.x upgrade not done.
- **Multiple owner-level accounts (A-43):** migration `multiple_owners` is applied to the production DB (PR #121) and `more_document_types` too. UI: "אדמין" label and owner management in the people screen (#124). The developer account is visible, owner-level. No backup exists (Free plan).
- **GO-LIVE-PREP is merged (#114, #122): scripts only, dry runs only, nothing written to the cloud.** Runbook: [GO_LIVE](GO_LIVE.md). Dry-run counts (24.11): 294 profiles, 193 projects, 313 auth users (312 `@example.invalid`, 1 other = the current demo owner; the purge then needs `--include-real-users`). Ben: `office@hy-ozma-ltd.com`; developer owner: `alon@melo-digital.com`.
- **Client change requests (25.11.2026, A-45) are merged:** CLIENT-FEEDBACK-A (#143, `af5ffe5`, no migration) and CLIENT-FEEDBACK-B (#144, `5dcd9e2`, migration for `project_notes` and `project_contacts` applied to the production DB after Alon's yes; rollback = drop both tables). **Not verified:** no browser pass at 360-1280 and no cloud suites for either (the stored cloud-test owner fixture `supabase/.temp/p12-owner.json` no longer signs in; repair it). Known gaps of A item 6 (non-owners see only active projects), closing them needs a migration: a file of a finished project is still readable by id via `/api/storage/files/[id]`, and the home "reports today" count may include finished projects. B follow-up: regenerate `src/types/database.ts` and drop `untyped-db.ts`; hard delete of a project with notes/contacts not exercised.
- **CLIENT-FEEDBACK-C is merged (A-46):** #149 (customers card removed) and #150 (optional task assignee, per-person open-tasks counter, "my tasks" filter). Two migrations applied to the production DB with Alon's yes: `tasks.assignee_id` + `create_task`/`update_task`, and `list_project_assignees`; rollback SQL is in `supabase/rollback/`. **Not verified:** no cloud tests after applying, no browser pass at 360-1280. Same gaps as A/B (cloud-test owner fixture does not sign in).
- **No task session is running.** Working model is A-39: a task brief per [TEMPLATE](handoffs/TEMPLATE.md); at most two task sessions at once; the PM does not write code or poll.

## Next (in this order)

1. **Go live data steps, run by the GO-LIVE-PREP session, each with Alon's direct "כן" in that session's chat:** purge demo data, create Ben and the developer owner, load the approved public projects from hy-ozma-ltd.com (list approved by Alon first), smoke test per role on the live URL. After this, no demo-test runs against the production DB: fake test accounts would show in the client's people list.
2. **P3.2 device/RTL/accessibility regression** with a signed-in session (never done in a real browser by any task session; Alon is testing on his phone), **P3.5** fixes and gate **G4**, then P4.2 acceptance with Ben and P4.3 a short guide. Alon's Supabase Pro upgrade (backup) must come before the client enters real data.
3. Decisions waiting for Alon and Maor: code ownership transfer (the repo is already in the org; Vercel Hobby limits private org repos), who is the contact for password resets (no mail service; the sign-in page says "פנו לבן").

## Open items (none blocks the next tasks)

- **Supabase Pro upgrade is postponed (Alon, 24.11.2026: "בעתיד").** Until then there is no backup on the Free plan. Purging demo data and loading the approved public projects is acceptable (nothing real is lost, the load is idempotent), but the client must not enter or rely on real data before the upgrade and a confirmed daily backup. Leaked-password protection also needs Pro. Any migration on this DB before the upgrade needs a rollback SQL stated in the D31 request.

- Vercel stays on Hobby (A-42). Code ownership transfer to the client (Maor wants the client to own it, Maor with access) is open: private org repos cannot deploy on Hobby, so options are the repo staying under Alon's account, or a personal GitHub account of the client; needs a decision from Alon and Maor. Vercel functions run in `iad1` while the DB is in Ireland: set the function region to Europe. `SUPABASE_SECRET_KEY` should be marked Sensitive; envs exist for Production only.

- Vercel (Linux) PDF generation not verified after PRINT-EXPORT; the server now logs `[reports] render failed: ...`.

- Not checked in a browser (no signed-in test session): P2.4, P2.5, P2.7, AUTO-UPLOAD, STICKY-HEADER at 360-1280. Needs one manual pass or P2.8.
- Upload: failed attempts leave pending unused rows (server cleanup topic); the shared Sheet backdrop/X can still close a form mid-upload.

- Excel RTL visual check never done; U+FFFE/U+FFFF in the Excel engine produce a corrupt file; the `uuid` alert in ExcelJS is assessed, not fixed.
- L7 protections (30 attempts per 5 minutes refill, session length via Management API) were not verified in the cloud.
- Not verified: real devices, screen readers, Vercel build.
- `tests/db/support/cloud.ts` does not use `tests/support/cloud-paths.ts` yet, so `tests/db` fails from a worktree; small shared test-support change.
- CI-CLOUD deferred (A-38). CI runs only the `unit` project; cloud suites run by hand in a window.
- Backups are deferred; ask Alon before real data. Node 24 is required (`engines`); Alon has 25 locally, works but warns.
- Alon asked for fewer repeats of the same UX complaints: every screen follows UI_CONVENTIONS; reviewers check it.

## Cloud and limits

- One exclusive cloud window at a time, assigned by the PM, released explicitly. Credential files (`.env.local`, `supabase/.temp/p12-owner.json`) are in the main checkout; tests find them from any worktree. Never open, print or copy them. **Each session needs Alon's direct yes, typed in that session's own chat; a PM message does not count.** Fake data only, tests clean up only their own rows.
- Supabase `izjmvyguzbampoasvnru` is also the production DB (Alon, 23.11.2026). New migration, service, cost, paid AI, production or deployment needs prior approval (D31): what, why, cost, rollback. No resets, no re-running migrations. A-34/A-35 stand (no mail service, no blocking hook).
- Alon views dev at `http://localhost:3000` in **Chrome**. Opera made all in-page buttons dead (browser issue, not code). `allowedDevOrigins` covers 127.0.0.1 and LAN.

## PM housekeeping

- Never `git stash` then `git stash pop` in the main checkout: the old `preserve local AGENTS` stash sits in it and a pop with nothing to stash applies it and conflicts. Leave that stash and `.gstack/` alone.
- Alon's local `package-lock.json` changes (from `npm install` on Node 25) are not committed.
- After each merged PR, delete its branch (Alon approved this, 23.11): remote and local, only if the PR merged and the tip matches. Suggest "Automatically delete head branches" in the repo settings (Alon's call).
- Left on purpose: worktrees `ozma-p1-2-followup`, `ozma-p1-4-5-diary`, `.codex/.../p1-4-1-users` (untracked files, not forced), `p1-4-3-tasks` (interrupted merge) and `ozma-p1-3-platform` (node_modules link); branch `codex/cloud-tests-ci` (deferred CI-CLOUD work).
- Disk was tight (5 GB free; a new worktree needs 5.4 GB). Archive finished sessions; Clear cache in Settings › Storage if it recurs.
