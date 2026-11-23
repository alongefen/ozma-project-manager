# Next session

23.11.2026. `origin/main` before the P1.4.10 PR: `9ac0122`. This file was rewritten in English (agent-facing doc).

## State

- **Phase 1 logic is complete.** All P1.4 tasks are merged: P1.4.1 PR #29 `cb4f44c`; P1.4.2 PR #27 `d9b97ad`; P1.4.3 PR #30 `6ceb34f`; P1.4.4 PR #33 `ab94f83`; P1.4.5 PR #28 `3d77909`; P1.4.6 PR #31 `e6e0a09`; P1.4.7 PR #44 `9ac0122`; P1.4.8 engine PR #12 `bf19434`, integration PR #39 `c5ea1c7`, docs PR #41 `0b84be7`; P1.4.9 engine PR #20 `c6910e3`, integration PR #36 `7e6fe5d`. P1.3-PROFILE-UPDATE is merged too (PR #40 `9a1b1af`).
- **P1.4.10 (depth gate) is done and waits for Alon: G2.** Evidence and the coverage matrix are in [P1.4.10](tasks/P1.4.10.md). It also fixed `update_project` losing `project_private.business_number` (migration `20261123083021`, approved by Alon under D31 on 23.11.2026, applied once to `izjmvyguzbampoasvnru`).
- **Do not start screens until Alon passes G2.** The next task after G2 is P1.5 (two shells, base components, sign-in); see WORK_PLAN. GU also applies there.
- Working model is A-39: the project manager opens a task with a brief from [TEMPLATE](handoffs/TEMPLATE.md); the task session builds and runs one `reviewer`; at most two task sessions at once.

## Open items to carry (none blocks G2 by itself)

- Excel visual check in RTL was never done (P1.4.9).
- U+FFFE and U+FFFF in the Excel engine produce a corrupt file; the fix was reported in progress and has not been delivered.
- The ExcelJS `uuid` alert was assessed and left unfixed.
- L7 protections (exact 30-attempts-per-5-minutes refill, session length via the Management API) were not verified in the cloud (P1.3).
- `tests/db/support/cloud.ts` finds `.env.local` and `supabase/.temp/p12-owner.json` only relative to the current directory, so it fails from a worktree with `CONFLICT` (nothing written). `tests/support/cloud-paths.ts` already solves this for the other suites; moving `tests/db` onto it is a small shared test-support change. On macOS the reports cloud test also needs `REPORT_TEST_CHROME`.
- CI-CLOUD is deferred (A-38). CI runs only the `unit` project; `tests/auth`, `tests/storage`, `tests/db` and every `*.cloud.test.ts` run by hand in a cloud window.
- Backups are deferred. Ask Alon before there is real data.

## Cloud and limits

- One exclusive cloud window at a time, assigned explicitly by the project manager and released explicitly. Cloud files (`.env.local`, `supabase/.temp/p12-owner.json`) live in the main checkout; never open, print or copy them. Fake data only; tests clean up only their own rows.
- The Supabase project `izjmvyguzbampoasvnru` is production-bound (D31). A new migration, service, cost, paid AI, production or deployment needs explicit prior approval with what, why, cost and rollback. No resets, no re-running existing migrations.
- A-34/A-35 stand: no mail service, no blocking hook, email confirmation is off on purpose.
- Old Codex sessions and worktrees are not resumed or cleaned; the old AGENTS stash and `.gstack/` stay untouched.
