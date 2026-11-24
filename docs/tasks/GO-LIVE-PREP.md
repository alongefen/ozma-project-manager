# GO-LIVE-PREP

24.11.2026. Branch `claude/objective-margulis-cd700e`. Writes nothing to the cloud. No migration, service or deployment.

## What changed

- `scripts/ops/purge-demo.mjs` + `purge-demo.sql`: dry run by default; real run needs `--confirm`, the project ref typed, and `--expect-total` from the dry run. Order: storage, one all-or-nothing SQL request, auth users, verify empty.
- `scripts/ops/seed-accounts.mjs`: owner via `system_bootstrap_owner`, developer via `create_profile` with Ben's session; passwords generated at run time, printed once.
- `scripts/import/extract-website-projects.mjs`, `load-projects.mjs`: public listing -> git-ignored JSON -> `create_project` as Ben with stable request ids; developer added to each project.
- Docs: `GO_LIVE.md`, `OPERATIONS.md`, `PRIVACY.md` (Hebrew), `DATA_IMPORT.md`.
- Tests: `tests/ops/*`, `tests/import/*` (22 unit tests, mocks only).

## Findings that shaped the design

1. **Immutability triggers block every delete**, also for the service key and also for `postgres`: `diary_*`, `sensitive_events`, `stored_files`, `transactions`. The purge must switch triggers off for its transaction (`session_replication_role = replica`). That is the approved exception for demo data.
2. **`service_role` has no table privileges** (`revoke all on all tables`). Counts and the purge therefore cannot go through the Data API with the secret key. They use the Supabase Management API SQL endpoint with a personal access token (`SUPABASE_ACCESS_TOKEN`): same project, no new service, no new dependency (no `pg` in the repo). The token is created and deleted by Alon.
3. Storage objects are removed through the Storage API (direct SQL delete on `storage.objects` is blocked by Supabase). The file list comes from `storage.objects`, so orphans go too.
4. Auth users are deleted last (`profiles.id` references `auth.users` with restrict).

## Developer account: design (superseded by A-43, see the update at the end)

The database allows **exactly one owner** (`create unique index one_owner on profiles(is_owner) where is_owner`), `system_bootstrap_owner` refuses when an owner exists, `set_membership` refuses owners, and `set_user_active` refuses deactivating an owner. So a second owner needs a migration.

| Option | Needs migration | What the developer can do | Cost / risk |
|---|---|---|---|
| **A (recommended, built)**: visible regular person, manager on every project, finance open | No | See and edit every project, documents, tasks, diary (own reports), finance. Cannot manage people, see the action log, change project status, archive, cancel transactions, set the cover or the business number. On completed projects: view and print only. Must be re-added by Ben (or by the load script) to each new project | Zero. Fits A-06: access is Ben's to give; the load script uses Ben's session. Ben can deactivate it |
| B: second owner | Yes (D31): drop `one_owner`, allow a flagged support owner, adjust `system_bootstrap_owner`, `set_user_active`, `set_membership` guards and the "only Ben adds or removes access" rule in PERMISSIONS | Everything | Changes permission logic, needs new tests and re-running the security session. Not recommended before launch |

Whatever the option, the developer holds the Supabase service key and dashboards, so technical access to all data exists regardless; PRIVACY.md says so in plain Hebrew. Proposal for the open question: Ben can deactivate the developer account (with an app warning that it is the client's data). Ask Alon.

If option B is chosen later: D31 request = what (one migration, 3 function guards), why (full support access visible in the app), cost 0, rollback (a down migration restoring the unique index after demoting the support owner).

## Website projects (39 public rows, `scripts/import/out/projects.local.json`, git-ignored)

Private (11): 2 family-name titles (flagged), plus Beer Sheva Kalaniyot, Yavne, Ramat Gan, Herzliya, Komemiyot, Rishon x2, Dekel, Beit Dagan. Restaurants (14: 5 coming soon). Shops/offices/clinics (14: 3 coming soon). Full list shown to Alon in chat for approval.

## Checked

- 22 unit tests pass (`npx vitest run --project unit tests/ops tests/import`); eslint and `tsc --noEmit` clean.
- The purge SQL's table list equals the script's `TABLES` and contains no schema statements (test).
- Dry run, confirm gates, expected-total gate, call order storage -> SQL -> auth, masking of non-demo emails, idempotent request ids: tested with mocks.
- The website extractor ran against the live public pages: 39 rows.

## Not checked

- Nothing ran against the cloud: the Management API endpoint, `has_parameter_privilege` probe, `session_replication_role` under the Management API role, Storage removal, `system_bootstrap_owner` and the project load are verified by reading code and migrations only. The first cloud dry run (read-only, after Alon's "כן") is the real check.
- Cover images and the other project fields are not imported.
- Reviewer pass: see below.

## Open questions for Alon

1. Approve the project list (and the two titles with family names).
2. Developer account: option A now (recommended) or B (migration)? Can Ben deactivate it?
3. Placeholder contact "יש להשלים" in each project: acceptable?
4. Who creates the Management API token (Alon, in the dashboard)?

## Update after migration 20261124120000 (A-43)

Alon chose owner-level accounts. `seed-accounts.mjs` now creates Ben with `system_bootstrap_owner` and the developer (alon@melo-digital.com) with `system_add_owner`, both with the service key. `load-projects.mjs` no longer grants the developer anything (owners see every project). The "Developer account" options table above is superseded. Purge still needs `--include-real-users` (one non-demo login). Nothing ran on the cloud for this follow-up; tests are mocks only.
