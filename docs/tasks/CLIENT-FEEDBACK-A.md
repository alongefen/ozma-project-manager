# CLIENT-FEEDBACK-A — client change requests (no migration)

25.11.2026, Alon, after the client demo. Branch `claude/awesome-edison-782e8d`. No migration, service or cost (D31).

## Changed
1. **Add a person to all projects** (owner only): `users/logic/commands.ts` `createBulkAccessCommand().addToAllProjects` (server action `addToAllProjects`). Reads active, non-archived projects and the person's memberships, then calls the existing `set_membership` once per missing project (`expectedRevision: null`, so finance stays off and existing roles are never touched). Returns `{ added, alreadyMember, failed }`. Refuses owner-level or inactive targets (VALIDATION) and non-owners (FORBIDDEN, live check). UI: "הוספה לכל הפרויקטים הפעילים" in the add-access panel of `PersonPanel`, uses the chosen role, shows the counts. Not atomic (one RPC per project); a partial failure is reported in the count and can be re-run safely.
2. **Diary print by range / all reports**: `PrintByDate` has a "מה להדפיס" select: one day, date range, all reports of the project. Uses the existing `range` scope of `/api/reports/diary` (no route change). "All" sends the sentinel range 2000-01-01..2099-12-31; the PDF header then reads "כל הדיווחים של הפרויקט" (`template.ts`). Same content rules (reporter, creation, edits, attached PDFs) because the same renderer is used.
3. **Tasks**: completed group hidden by default on phone and desktop, with a toggle showing the count.
4. **Projects**: finished projects hidden by default; owner-only toggle "הצגת פרויקטים שהסתיימו" (`ProjectsBrowser`). The old 3-way status filter is gone.
5. **Finance**: "(לא כולל מע״מ)" next to every income label: project and all-projects finance (desktop, phone, print view) and the Excel export labels. Transfer summary headers too.
6. **Non-owners see only active projects**: X06 view access is superseded (PERMISSIONS updated). Closed in the app layer: `getDocument` by id (reviewer finding, fixed), `permissions.forProject` returns all-false for a non-owner on a finished project (covers tasks, files, diary, reports, finance, print); `listProjects` and `getProject` (404) filter; the all-projects diary excludes finished projects. No SQL or RLS change.
7. **Finance card removed** from the projects page (both shells). `getHome` still computes `financeCube` (contract and tests unchanged); it is just not rendered.

## Checked
- `tsc --noEmit` and `eslint --max-warnings=0` clean.
- Unit tests (affected suites: users, projects, diary, tasks, finance, finance-export, overview, reports, screens) pass. New: `tests/logic/users/bulk-access.test.ts` (counts, finance off, non-owner refused, owner/inactive target refused), `tests/logic/projects/finished-visibility.test.ts` (forProject closes a finished project for a non-owner, owner and active unaffected, listProjects filter). Updated: overview and tasks render tests, finance-export labels.

## Not checked / open
- No cloud tests and no real browser pass at 360-1280 (no signed-in session; cloud needs the PM window and Alon's yes). Server refusals for 6 and 1 are covered with fakes only; confirm on cloud with a manager/worker membership on a finished project.
- Known gaps of item 6 (RLS untouched, needs a migration to close): a stored file is still readable by its id through `/api/storage/files/[id]` for a non-owner who knows it; "reports today" in the home counter may still count a finished project's reports.
- The "all reports" PDF uses a sentinel range, so a report dated after 2099 would be missed (unrealistic).
