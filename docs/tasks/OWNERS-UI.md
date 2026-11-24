# OWNERS-UI: admin (owner-level) management in the people screen

24.11.2026. Follows OWNERS-MIGRATION / A-43. No migrations, services, costs or dependencies (D31).

## Changed
- Label: owner-level people are shown as "אדמין" (`ADMIN_LABEL`) in the list/table badge, the role filter value, and the person sheet. Table action for an admin reads "ניהול אדמין". The users page refusal says "רק אדמין יכול...".
- `logic/commands.ts` + `logic/actions.ts`: new `setOwnerLevel` (local zod schema, owner-only via `ownerOperation`, calls `set_owner_level`). Kept local to the feature because `src/types/contracts` is shared; fold into `UsersApi` in a serial shared change if wanted.
- `PersonPanel`: for an admin, a notice that states full access (all projects, finance, documents, other admins) and an account section. For a plain active person: "הפיכה לאדמין". For another admin: "איפוס סיסמה", "השבתת חשבון", "הסרת הרשאת אדמין". Promote and demote go through a `ConfirmDialog` that states the consequence and that nothing is deleted. Deactivating an admin warns that it also removes the admin level (server rule) and the row is patched locally the same way.
- Own account: no controls, only "זה החשבון שלכם". Last active admin: deactivate and demote are disabled with an explanation (`aria-describedby`).
- Server refusals (one FORBIDDEN for self, last admin, inactive target) show Hebrew text per action (`ownerErrorText`); CONFLICT refreshes the list.
- `UsersManager` / page: pass `viewerId` (from server context) so the sheet knows who is "you" and can count active admins from the loaded list.
- Not touched: sign-in and header labels (the header still shows "מנהל מערכת" to an owner; one-word follow-up in `src/app/(app)/layout.tsx`, a shared file).

## Checked
- `tsc --noEmit` and eslint clean on touched files.
- Vitest (quiet): `tests/screens/users`, `tests/screens/ui`, `tests/logic/users/{actions,commands,queries}`, `tests/security/static`: pass. New: view-model tests for label/filter/controls/refusal text, action test (context from server, extra fields refused), command test (owner required, exact rpc input).
- Server-side refusal for manager/worker calling the functions directly was already covered by OWNERS-MIGRATION (`tests/db/owners.test.ts`, role-matrix); not re-run here.

## Not checked
- Real browser pass at 360/375/390/768/1024/1280: no signed-in session or env in this worktree. Layout reuses existing `.row` (wrapping flex) and `Button`s, so no new width risk is expected, but it was not seen.
- Cloud tests (need Alon's direct yes). No data was written to the cloud DB.

## Open
- Visual pass of the sheet with two admins on a signed-in session.
- Header label wording ("מנהל מערכת" vs "אדמין") and a `setOwnerLevel` entry in the `UsersApi` contract: shared files.
