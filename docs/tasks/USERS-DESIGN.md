# USERS-DESIGN — people page aligned with the other screens

24.11.2026. Alon's request: same header structure and search placement as the other screens, plus filters. No migrations, services or dependencies (D31).

## Changed
- `shared/UsersManager`: one pinned row like documents/files. Desktop: "הוספת אדם" first, then search (max 360px), project, role and status `SelectField`s in the same `Pin` row. Phone: full-width add button in `Pin`, then the filter row (search on its own line, three dropdowns beneath).
- `view-model.ts`: `filterUsers` now takes a filter (search, project, role, status). Project = people with access to it, or "ללא פרויקט"; role is checked on the chosen project, otherwise on any project (or system owner); status = active / deactivated. Computed client-side from rows `listUsers` already returns (owner only), so nothing new is exposed. Project options come from the people's assignments.
- Cards and table unchanged (already shared `Card`/`Badge`). Empty text differs for "no people" and "no match".

## Checked
- tsc, eslint clean; `tests/screens` 163 tests pass (7 new filter tests in `tests/screens/users/view-model.test.ts`).
- Not checked: real browser pass at 360-1280 (no signed-in session in this worktree); visual layout is by CSS reading only. No cloud tests.

## Open
- Visual pass at the six widths after merge on a signed-in session.

## Review (one pass)
Fixed: skeleton bar widths now match the new row (`loading.tsx`); project options also come from the `projects` prop. Phone filters sit under the pinned add button, same as files.
