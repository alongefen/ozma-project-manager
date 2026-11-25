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

## Follow-up 1 (Alon, via PM): owner sees both numbers

- Open-tasks card: the owner now sees "כולם" (all open tasks) and "שלי" (assigned to them, 0 when none) in one card; manager/worker still see their own single number. New counters `allOpenTasks` / `allTasksProjectId` (owner only, null otherwise). No migration.
- Each number links to the tasks page ("שלי" with the `?mine=1` filter on) **only when its tasks are all in one project**; there is no tasks page across projects, so with several projects the number is not a link. A cross-project tasks screen would be a new feature: open item for the PM / Alon.
- Checked: unit screens + logic (973 pass), tsc, eslint. Not checked in a browser (360–1280).

## Follow-up 2 (Alon, via PM): long sheets scroll (access sheet with many projects)

- Cause: `Sheet` had a `menus` flag (used by the people access sheet, the project access "add" sheet and the filter sheet) that set the body to `overflow: visible`, so a long project list pushed the buttons below the viewport. The flag existed so dropdowns would not be clipped. `SelectField`/`DateField` pop-ups are native popovers in the top layer and never clip, but the two access sheets used an older in-flow `Select` (absolute list) that would clip once the body scrolls (reviewer finding). Those 5 uses (people access sheet, project access list and the add-access sheet) now use `SelectField`, and the unused old `Select` component and CSS are deleted. The flag is removed; every `Sheet` body now scrolls inside `max-height` (90dvh phone, 88vh desktop) with the header fixed. This covers all other long sheets that use the shared `Sheet`.
- Checked: unit screens (203 pass), tsc, eslint. **Not checked in a browser** at 360/390/desktop with 20+ projects, and not that the dropdowns inside these sheets still open correctly: the PM or Alon should try both.

## Follow-up 3 (Alon): account buttons next to "עריכת שם"

- In the people sheet the account actions (איפוס סיסמה, השבתת חשבון / הפעלה מחדש, הפיכה לאדמין / הסרת הרשאת אדמין) moved from the bottom into the top row beside "עריכת שם", above the scrolling project list. The reset-password form and the "last admin" / "your own account" notes open under that row. The old "חשבון" section is gone. Same rules and dialogs as before; no logic change.
- Checked: unit screens + users logic (236 pass), tsc, eslint. Not checked in a browser at 360–1280 (the row wraps on narrow screens).

## Follow-up 4 (A-47): several assignees; picker shows members AND admins

Findings first: #147 already lists active admins (read-only) and all members on the project access page. What is still wrong there: members whose account is disabled still show ("חשבון מושבת"); Alon wants them hidden (UI only, no migration). The assignee picker (`list_project_assignees`) and `check_assignee` only knew membership rows, so admins could not be picked: that needs SQL.

### D31 (applied 25.11.2026 after Alon's typed "כן"; checked afterwards: table with RLS on, 5 functions present, 0 backfilled rows because no task had an assignee yet)
- Migration `supabase/migrations/20261125150000_task_assignees.sql` (one file for both parts): new table `task_assignees(task_id, user_id, project_id)` (RLS read = project member and task not deleted; no write grants, writes only in the two functions; FK to tasks cascades so the A-44 hard delete needs no change), backfill from `tasks.assignee_id`, helpers `private.check_assignees` / `private.assignee_ids`, `create or replace` of `create_task` / `update_task`, and replacement of `list_project_assignees` (active members plus active owner-level accounts, new `is_owner` column). `tasks.assignee_id` stays and is kept equal to one assignee (the lowest user id, because the list is de-duplicated and sorted; irrelevant to the app, only visible after a rollback).
- The functions accept the new `userIds` array and the old `assigneeId`, so the app version running before the deploy keeps working between "migration applied" and "PR merged".
- Rollback `supabase/rollback/20261125150000_task_assignees.down.sql`: restores the previous bodies of the three functions, drops the helpers and the table (multi-assignee rows are lost, `assignee_id` keeps one assignee per task (the lowest user id)). No backup exists (Free plan). Cost: none.

### What changed in code (A-47)
- Contracts: `TaskRow.assignees: {id,name}[]` (replaces the single assignee), `TaskAssignee` gains `isOwner` and a nullable role, inputs take `assigneeIds?: Uuid[]` (sent to the database as `userIds`; omitted = unchanged, `[]` = none). `listTasks` reads `task_assignees` for the project and names from `list_project_assignees`.
- Form: "אחראים (רשות)" checkbox list (members and admins, admins labelled "אדמין"), bounded height with its own scroll. Row: all names on desktop; first name and "+N" on phone. "המשימות שלי" and the home "שלי"/personal counter count a task when the user is among its assignees. An unchanged list is not sent on edit.
- Access page: members whose account is disabled are no longer listed (admins and active members unchanged, #147 untouched).
- Known gaps: people who were deactivated or left the project do not appear as assignees and are dropped from a task when its assignee list is edited. The migration SQL had one syntax slip (`coalesce(...)[1]` needs parentheses) fixed in the file before it was applied.
- Checked: unit screens + logic (974 pass), tsc, eslint; cloud read check above. **Not checked:** server refusals on the cloud (non-member, inactive, other project), a real create/edit round trip with several assignees, and the browser at 360–1280.

### Follow-up 5 (Alon): monday.com-style multi-select
- New shared `MultiSelectField` (src/components/ui): the chosen people stay visible as chips, each with a small × remove button; "הוספה" opens the same pop-up as `SelectField` (menu on desktop, bottom sheet on phone) with search and ticks, and it stays open while ticking. Replaces the checkbox list in the task form. Admins/roles show as a hint in the list.
- Checked: unit screens + logic, tsc, eslint; in the in-app browser at 390px on a throwaway page: chips and × render, ticking adds a chip, × removes it, the list stays open. Not checked: 360/375/768/1024/1280, the real task sheet with a long list, keyboard use, visual polish of the chips (the pane's screenshots were taken mid-animation).
