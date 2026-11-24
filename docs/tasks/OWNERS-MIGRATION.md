# OWNERS-MIGRATION: several owner-level accounts

**Status:** APPLIED to the cloud project on 24.11.2026 after Alon's direct yes (via the Supabase MCP `apply_migration`, name `multiple_owners`; the history version is assigned by the tool, not the file's timestamp). Cost 0.

## What changes
- `20261124120000_multiple_owners.sql`: drops unique index `one_owner`; adds audit action `owner.demoted`;
  new `set_owner_level` (owners only), new `system_add_owner` (service only);
  `set_user_active` accepts owner targets (not self, not the last owner; deactivating an owner also clears `is_owner`,
  because the table rule "an owner is always active" stays); `system_owner_recovered` takes `userId`
  (optional only when exactly one owner exists, so the old call keeps working).
- No new column or role. Everything on `private.owner()` is unchanged. `set_membership` still refuses owner targets.
- `revoke_user_sessions` already accepted owner targets.
- Changed rule (A-06): "only Ben changes access" becomes "any owner". An owner can demote or deactivate the other owner.
- `src/types/database.ts` got the two new function types and `tests/depth/role-matrix.cloud.test.ts` the matching rows (catalog guard).

## Evidence
- Dry run in ONE cloud transaction that always ends in an exception (nothing persists), Alon's yes 24.11.2026:
  45 of 46 checks passed; the 46th was a test-setup slip (actor without a profile got UNAUTHENTICATED instead of FORBIDDEN, still refused). Script: `tests/db/support/owners-dryrun.sql` after the migration text.
- After apply, read-only check: 294 profiles, 1 owner, 1611 events (unchanged); `one_owner` gone; `set_owner_level` executable by authenticated only, `system_add_owner` by service_role only; advisors show only the existing pattern (set_owner_level joins the intentional authenticated SECURITY DEFINER set, guarded by `require_owner`).
- `tests/db/owners.test.ts` (real JWTs, fake data): 5/5 pass. With `tests/db/permissions.test.ts`, `tests/depth/role-matrix.cloud.test.ts` and `tests/security/data-api.cloud.test.ts`: 110/110 pass. `tests/security/http.cloud.test.ts` not run (needs `npm run build`).
- The rollback SQL was reviewed against the original function text but NOT executed (a real execution would have meant a second change to a no-backup DB); the forward change was dry-run in a rolled-back transaction instead.
- A first, failed test run left 4 fake owners; they were deactivated and demoted by hand (SQL on `p12-*@example.invalid` rows); the final DB has 1 owner.
- Not checked: the "last owner" guard against a non-self actor (unreachable through the API, since self-targeting is refused and a deactivated owner cannot act); UI label "אדמין" (not done, UI untouched).

## Review notes (accepted)
- Two owners acting on each other at the same instant can deadlock (caller's FOR SHARE vs advisory lock 190012); Postgres aborts one call (40P01). No corruption, invariants hold.
- Promoting a user keeps their old memberships; they come back if the user is demoted later.
- `tests/db/owners.test.ts` deactivates every owner it creates in `afterAll` (the old `system_owner_recovered` call shape needs exactly one owner).

## Rollback
`supabase/rollback/20261124120000_multiple_owners.down.sql` (by hand, after Alon's yes): keeps the oldest owner, demotes the rest,
recreates `one_owner`, drops the two new functions, restores the old `set_user_active` and `system_owner_recovered`.
Cannot undo: demoted accounts keep existing as ordinary users (memberships to re-grant by hand); `owner.demoted`/`owner.created` audit rows stay;
the wider audit-action list stays. No backup exists on the Free plan, so the rollback is a forward fix, not a restore.

## Follow-ups (project manager)
- `scripts/ops/seed-accounts.mjs`: add the developer through `system_add_owner`, not as manager; `load-projects.mjs` no longer needs `grantDeveloper`.
- `docs/OPERATIONS.md`: owner recovery now takes `userId` when more than one owner exists.
- DECISIONS: A-06 wording ("owners", not "Ben alone").
- UI: show "אדמין" for non-first owners; an owner-management screen calling `set_owner_level`.
