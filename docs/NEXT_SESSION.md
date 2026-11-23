# Next session

23.11.2026, evening. `origin/main`: `e50169b`. Agent-facing doc, in English. Start here, then `git log --oneline -15` and `gh pr list`.

## State

- **Depth phase is done and G2 is approved (A-40).** P1.4.1-P1.4.10 are merged; P1.4.10 also fixed `update_project` dropping `business_number`. See [P1.4.10](tasks/P1.4.10.md).
- **Screens are being built, each phone + desktop over shared logic.** Merged: P1.5 shells and sign-in (PR #47), P2.2 project file/form/wizard (#49, #56, #66), P2.6 project finance (#48, #57, #58, #59, #62), UX-FOUNDATION (#63; rules in [UI_CONVENTIONS](UI_CONVENTIONS.md)), P2.3 tasks (#64), P2.1 workers (#65), TAB-NAV-FIX (#67).
- **No task session is running.** Working model is A-39: open a task with a brief from [TEMPLATE](handoffs/TEMPLATE.md); the task session builds and runs one `reviewer`; at most two task sessions at once; the PM does not write code or poll.

## Next (in this order)

1. **P2.4 documents** and **P2.5 diary and reports**: independent, run in parallel. Both add project tabs: build them under `src/app/(app)/projects/[id]/(tabs)/`, content-only `loading.tsx`, add the tab to the order in `tab-motion` (UI_CONVENTIONS). Briefs must tell the session to read UI_CONVENTIONS in full.
2. **P2.7 home and `/finance` (all projects)**, after P2.1-P2.6. The nav item "כספים" already points to `/finance`, which 404s until P2.7. The logic exists (P1.4.7).
3. **P2.8 core integration**, then gate G3 (Alon).

## Open items (none blocks the next tasks)

- Excel RTL visual check never done; U+FFFE/U+FFFF in the Excel engine produce a corrupt file; the `uuid` alert in ExcelJS is assessed, not fixed.
- L7 protections (30 attempts per 5 minutes refill, session length via Management API) were not verified in the cloud.
- Not verified: non-owner views live (only an owner test account exists), real devices, screen readers.
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
