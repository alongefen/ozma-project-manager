# OWNERS-MIGRATION: several owner-level accounts

**Status:** code ready; NOT applied to the cloud (D31 yes pending). Cost 0.

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
- `tests/db/owners.test.ts` (real JWTs, fake data): runs after apply.
- Not checked: the "last owner" guard against a non-self actor (unreachable through the API, since self-targeting is refused and a deactivated owner cannot act); UI label "אדמין" (not done, UI untouched).

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
