# CLIENT-FEEDBACK-C: clean home screen, optional task assignee

25.11.2026. Change requests of A-45 / A-46 (PM records A-46).

## Part 1: customers card removed (no migration)

- The "לקוחות" counter card is gone from the home screen (`counterItems`). Three cards remain: active projects, reports today, open tasks.
- Phone / tablet shell (< 1024px): the open-tasks card is the odd last card and spans the full width. Desktop: three equal columns, no gap.
- The `counters.customers` value is still computed and in the contract (unused by the UI); removing it would touch the shared contract, left for a later cleanup.
- Checked: `vitest` overview logic + screen tests (21 pass), `tsc --noEmit`, `eslint src/features/overview`. Not checked in a browser at 360–1280 (no signed-in session in this worktree); the CSS change is two rules.

## Part 2: optional task assignee

D31 (awaiting Alon's typed "כן" in the task chat; nothing applied):
- What: nullable `tasks.assignee_id` (FK profiles, restrict), index, helper `private.check_assignee`, `create or replace` of `create_task` / `update_task`. Why: client request. Cost: none (Free plan). No backup exists.
- Migration: `supabase/migrations/20261125120000_task_assignee.sql`. Rollback: `supabase/rollback/20261125120000_task_assignee.down.sql` (restores the previous function bodies, drops helper, index, column; destroys stored assignees).
- Contract: `assigneeId` optional in both functions; omitted = unchanged on update; `''` = none (`private.keys` rejects JSON null for this key and is not changed). Value must be an active profile with a membership on the same project, else VALIDATION. Finished projects stay read-only (`require_project` unchanged).
- Known gap: a member removed from the project later stays as assignee until the task is edited (display only).
- UI (counter per person, "המשימות שלי", row/form) is built after the migration is applied.
