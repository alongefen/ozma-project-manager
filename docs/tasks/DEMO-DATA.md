# DEMO-DATA: fictional demo projects for the client meeting

24.11.2026. Branch `claude/objective-bhaskara-d338ee`. Owned files: `scripts/demo/**`, `tests/demo/**`, `docs/DEMO.md`, this file. No migrations, no `supabase/**`, no app code.

## Built
- `scripts/demo/seed-demo.mjs` (dry run default; real run `--confirm --project-ref`, owner password only via `GO_LIVE_OWNER_PASSWORD`), `remove-demo.mjs`, `plan.mjs` (the fictional content), `assets.mjs` (local files), `ledger.mjs` (git-ignored `scripts/demo/out/ledger.local.json`).
- Seed uses only the app's functions (`create_profile`, `create_project`, `set_membership`, `set_finance_access`, `begin_upload` + `system_finish_upload`, `set_project_cover`, `create_entry`, `correct_entry`, `create_document`, `create_task`, `create_transaction`, `update_transaction`, `cancel_transaction`, `set_project_status`). Each item has a fixed request id and a ledger step.
- Remove reuses `PROTECTED`, `enableTriggersSql`, `probeSql` and `removeStorage` from `scripts/ops/purge-demo.mjs`.
- Counts and the walk-through: `docs/DEMO.md`.

## Checked
- `tests/demo` (28 tests, quiet reporter): plan is fully marked fictional and matches the brief; dry run offline; real-run guards; ledger gets every row; passwords printed once and never logged or stored; the finished project is closed after its last write; retry duplicates nothing; failed call keeps a usable ledger; removal SQL scoped to ledger ids, one transaction, triggers off first and on last, injection-proof; refusals (foreign rows, non-demo login, no privilege, wrong `--expect-total`); trigger re-enable on failure; idempotent second run; ledger and generated files.
- eslint and `tsc` clean for `scripts/demo` and `tests/demo`.
- Seed dry run printed the counts in DEMO.md.

## Not checked yet
- No cloud call has been made: the real seed and the removal run only after Alon's direct "כן" in the task session (separate "כן" for the removal).
- The seed was written against the function bodies in the migrations, not run against the cloud; the first real run is the first end-to-end proof (a failure stops early and the ledger can be removed).
- Screens were not opened (no app code changed); the smoke check after the real seed is recorded below once done.

## Finding during the real run
- The `originals` storage bucket allows only PDF and images (`allowed_mime_types`), although `begin_upload`/`system_finish_upload` accept Office types since 20261124095924. Uploading an Excel/Word file would fail in the app too. Not fixed here (D31: a bucket change needs its own approval); the demo uses PDFs instead. Reported to the project manager.

## Real seed run (24.11.2026, after Alon's direct "כן")
- First attempt stopped at the first Excel upload (bucket restriction above); the retry skipped finished steps and completed. Orphan: one pending, never uploaded Excel row of the building project, listed in the ledger, so the removal handles it.
- Verified read-only with SQL: 3 demo projects (1 completed), 5 demo logins, 3 owners untouched, 39 real projects and their 39 covers untouched, 22 reports (24 versions), 12 documents, 10 tasks, 34 transactions (3 cancelled), all 7 protection triggers enabled. Not done: opening the screens in a browser.
