# HIDE-TECH-ADMINS: technical admins are not assignee options

Client request (Alon, 26.11.2026): the two technical admins (Alon the developer, Maor) do not work in the business and must not appear as task assignee options. Ben and any other admin who works in the business still do. Everything else is unchanged: technical admins keep full owner rights and stay in the people screen and access lists.

## Decision made in this task
- **No existing marker** distinguishes the technical accounts (A-43 has none), so: `profiles.technical_admin boolean not null default false`. No email is hardcoded; an admin sets it per admin in the people screen ("מנהל טכני, לא מופיע בבחירת אחראי", under the admin's panel). Alon sets it for himself and Maor in the live UI.
- The flag only matters while the account is owner-level (`is_owner and technical_admin`); it is left as is on demotion and has no effect on a non-owner.
- **Existing assignments:** a technical admin already assigned to a task keeps showing on that task and stays selectable in that task's form (nothing is dropped). `list_project_assignees(p, keep uuid[] default '{}')` returns a flagged admin only when their id is in `keep`; the app passes the ids already linked on the project's tasks. The form (`assigneeOptions`) offers a flagged admin only on a task that already has them. With one argument (the plain picker call) the flagged admin is never returned, for any project.
- `set_technical_admin` is owner-only, accepts only an owner-level target, uses the profile revision (CONFLICT on stale), can be applied to oneself, and audits as the existing `user.updated` (so the audit action list needs no change).
- The server `check_assignees` is unchanged: assigning is by the app's picker only; this is not a permission change.

## Migration (D31, NOT applied; waits for Alon's "כן" in the chat)
`supabase/migrations/20261126100000_technical_admin.sql` (one boolean column, one new function, the picker function replaced). Rollback: `supabase/rollback/20261126100000_technical_admin.down.sql` (restores the previous picker body, drops the function and column; flag values are lost; deploy the app without the flag first). Cost: none. No backup exists on the Free plan. No resets; existing migrations are not re-run.

## What changed
- DB: above. Types: `database.ts` (column, function), `UserRow.technicalAdmin`, `TaskAssignee.technical`.
- `src/features/users`: `setTechnicalAdmin` action/command; PersonPanel checkbox for admins (shared by phone and desktop); profile read includes the flag.
- `src/features/tasks`: query passes `keep`, `assigneeOptions` in model + TaskForm.
- Tests: `tests/screens/tasks/model.test.ts` (options rule); `tests/db/technical-admin.test.ts` (server checks: flagged admin not returned for any caller, Ben and members are, only owner toggles, non-owner target and stale revision refused, `keep` restores only the listed id, audit rows). The db test is written but **not run**: it needs the migration applied (D31) and a PM cloud window.

## Checks and results
- `tsc --noEmit`: clean. `vitest tests/screens/tasks tests/screens/users`: pass (43 tests in tests/screens/tasks and tests/screens/users). The `tests/logic/users` cloud test fails at sign-in (known owner fixture gap, unrelated).
- Not checked: cloud DB test (before migration), browser at 360-1280 (the new control is one existing `check` row, 44px, in the shared PersonPanel; unverified visually), live toggle.

## Open
- D31 "כן" from Alon; then apply, run `tests/db/technical-admin.test.ts` in a PM window, and Alon flags himself and Maor.
- DECISIONS entry: the PM records it.

## Review
One reviewer pass: approved, no blocking findings. Applied: `service_role` also revoked on `set_technical_admin`; test count corrected. Accepted: the task page now waits for the links read before the picker read (one extra round trip). **The PR must not be merged before the migration is applied:** the app reads `profiles.technical_admin`, so merging first would break the people screen.
