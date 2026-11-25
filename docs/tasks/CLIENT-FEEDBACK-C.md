# CLIENT-FEEDBACK-C: clean home screen, optional task assignee

25.11.2026. Change requests of A-45 / A-46 (PM records A-46).

## Part 1: customers card removed (no migration)

- The "לקוחות" counter card is gone from the home screen (`counterItems`). Three cards remain: active projects, reports today, open tasks.
- Phone / tablet shell (< 1024px): the open-tasks card is the odd last card and spans the full width. Desktop: three equal columns, no gap.
- The `counters.customers` value is still computed and in the contract (unused by the UI); removing it would touch the shared contract, left for a later cleanup.
- Checked: `vitest` overview logic + screen tests (21 pass), `tsc --noEmit`, `eslint src/features/overview`. Not checked in a browser at 360–1280 (no signed-in session in this worktree); the CSS change is two rules.

## Part 2: optional task assignee (A-46)

Applied to the cloud database on 25.11.2026 after Alon's typed "כן" in this chat, both migrations through the Supabase tool. Nothing was reset or re-run.

### D31
- `supabase/migrations/20261125120000_task_assignee.sql`: nullable `tasks.assignee_id` (FK profiles, restrict), index, `private.check_assignee`, `create or replace` of `create_task` and `update_task`. Rollback: `supabase/rollback/20261125120000_task_assignee.down.sql` (restores the old bodies, drops helper, index, column; destroys stored assignees).
- `supabase/migrations/20261125130000_task_assignee_list.sql`: new read function `public.list_project_assignees(p)` (id, name, role of the active members of one project, only for members of it). Needed because RLS lets a non-owner read only themselves. Rollback: `...130000_task_assignee_list.down.sql` (one `drop function`). Cost of both: none. No backup exists (Free plan).
- `assigneeId` is optional: omitted = unchanged on update; `''` = none (`private.keys` rejects JSON null and was not changed). A value must be an active profile with a membership on the same project, else VALIDATION. `require_project` is unchanged, so finished projects stay read-only.
- Not applied this way in git history: both were applied with the SQL of these files minus the outer begin/commit.

### What changed
- Contracts: `TaskRow.assigneeId/assigneeName`, `TaskAssignee`, `listTasks` returns `assignees`; `createTask`/`updateTask` take optional `assigneeId` (null clears); `counters.myOpenTasks`, `counters.myTasksProjectId`. `schemas.ts` edited by hand to match.
- Tasks: assignee select ("אחראי (רשות)", `SelectField`) in the shared form, "אחראי: name" on the card, "המשימות שלי" toggle button (`aria-pressed`, `?mine=1` opens it on) on phone and desktop. The filter narrows only the open group.
- Home open-tasks card, **my choice**: the owner sees the total of open tasks as before; anyone else sees only the open tasks assigned to them. The card links to that project's tasks with "mine" on when all of them are in one project; with several projects (or for the owner) it is not a link, because no cross-project tasks page exists.
- Owner-level accounts have no membership, so they cannot be picked as assignee (members only, per the brief).
- Reads of the new column and function go through `untypedDb` (generated `database.ts` not regenerated).
- Docs: PRD TASK-05 and the tasks data row, PERMISSIONS function and P18 rows.

### Checked
- `vitest` unit: `tests/screens`, `tests/logic` (970 pass, 5 skipped), `tsc`, `eslint` clean. New tests: draft assignee parsing, `onlyMine`, home counter per person.
- **Not checked:** server refusals on the cloud (assignee from another project, finished project, non-owner on a finished project) — no cloud tests were run (they need a PM window and Alon's yes); the logic is in the SQL helper and `require_project`. Not checked in a browser at 360–1280 and RTL. The stored cloud-test owner fixture was not used.

### Review (one reviewer pass) and open items
- Fixed: an unchanged assignee is no longer sent on edit (a task whose assignee left the project stays editable); the home read of own assignments is skipped for owners; the "mine" button uses a CSS class.
- Open for the PM / Alon: owner-level accounts have no membership row, so they cannot be assigned or appear in the picker (as the brief says: members only). The phone counter counts open tasks on every visible project, as the old total did. No unit test for the stale-assignee edit or for the server-side refusals.
