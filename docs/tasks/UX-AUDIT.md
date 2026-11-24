# UX-AUDIT: one design and interaction language

24.11.2026. Alon's request: (1) the people and permissions page has no header, (2) the diary title differs from projects and finance, (3) a full consistency audit. Presentation only. No migration, service, cost, dependency or deployment. Not touched: `playwright.config.ts`, navigation structure (P2.8), data, queries, permissions, print/export logic.

The language is defined in UI_CONVENTIONS "One language for actions". It is enforced by `tests/screens/ui/one-language.test.ts`.

## Inventory (method: every screen's phone and desktop source read; deviations listed with the fix)

Header structure: top-level routes show the phone shell header and, on desktop, `DesktopTitle`; inner routes show `PageHeader`. Pinned row: `Pin`. All screens already used `Pin`, `PageHeader`, `SelectField`, `DateField`, `ConfirmDialog`, `StateMessage` and skeleton rules.

| # | Screen | Deviation found | Fix | State |
| --- | --- | --- | --- | --- |
| 1 | `/users` desktop | No title row: the page started with the action bar, so it did not look like part of the app | `DesktopTitle` "עובדים והרשאות" (matches the phone shell title and the breadcrumb); `loading.tsx` renders the same title | fixed |
| 2 | `/diary` desktop | Title was a local `h2` (22px, inside `dr-bar`), different place and size from projects and finance (`h1`, 32px `ui-ph__title`) | `DesktopTitle`, now shared in `components/ui`; local `dr-bar` removed; loading uses `title` | fixed |
| 3 | project diary tab, tasks tab (desktop) | A second local `h2` title ("יומן", "משימות") under the project header, unlike documents and finance tabs | removed: inside a project the tab is the title; loading headings removed too | fixed |
| 4 | Finance, project finance, project tabs, other projects (non-owner) | Default framework 404 page without the shell | `(app)/not-found.tsx` renders `StateMessage` inside the shell; status stays 404, no data, no hint whether the page exists | fixed |
| 5 | Icons | Pen, bin, print, download drawn three times (finance, diary, project) with different strokes | one set in `ui/ActionIcons`; `FinIcons` and `DiaryIcons` deleted | fixed |
| 6 | Row edit/delete/print/export buttons | Three icon-button classes (`fin-iconbtn`, `dr-iconbtn`, `iconBtn`) and a text-link remove button | one `IconButton` (`ui-iconbtn`, danger and plain variants) | fixed |
| 7 | Task cards | Text buttons "עריכה" / "מחיקה" instead of icons | `IconButton` pen and bin (labels unchanged) | fixed |
| 8 | Remove access (project access manager, person panel, wizard) | Secondary text buttons "הסרת גישה" / red text link "הסרה" | `IconButton tone="danger"` with the person or project in the label; still confirmed by `ConfirmDialog` | fixed |
| 9 | Project details, desktop edit | Primary small "עריכת פרטים" (competed with the screen's primary), phone used a pen icon | secondary small `Button` with the pen on desktop; phone `IconButton` pen | fixed |
| 10 | Create buttons | "+ " typed in some labels (diary, tasks, files), none in others, no icon anywhere | `Button icon="add"` on all create buttons, phone and desktop; "+ " removed | fixed |
| 11 | Finance desktop toolbar | Print had no icon while export had one | printer icon added | fixed |
| 12 | Finance phone and desktop rows | Delete before edit in the DOM on finance and diary, but task cards had edit first | one row order: print, export, delete, edit | fixed |
| 14 | Pinned rows (desktop) | The create button sat at the far left on diary and projects but at the right on users, documents, tasks and finance | create button first (rightmost) in every pinned row, plus icon at the left of the label (Alon, 24.11); project creation got the plus | fixed |
| 15 | Task wording | "משימה חדשה" on desktop, "פתק חדש" on phone, in windows and dialogs | Alon decided (24.11): "משימה" everywhere; user-facing "פתק" replaced | fixed |
| 13 | Tasks desktop | Pinned bar kept `space-between` for a title that is gone | bar is the button only, at the start | fixed |

## Left on purpose (listed, not open defects)

- **Documents rows** use an action menu (open, download, permissions, archive) with no loose icons: five actions, decided in DOCS-ROWS. The menu words match the language.
- **Excel glyph** on the finance export keeps Alon's chosen icon; it is the export action drawn for a spreadsheet.
- **Diary toolbar** "הדפסה וייצוא לפי תאריך" is one button that opens a window with two separate controls (print, export); kept from PRINT-EXPORT.
- **Navigation** (P2.8): nothing found that breaks the language; `/log` and the archive link stay removed.
- **`playwright.config.ts`** `testMatch`: separate shared change (P2.8 item 3).

## Checked

- `tsc` and `eslint` clean; `vitest --project unit tests/screens tests/shell`: all pass, including the new `tests/screens/ui/one-language.test.ts` (shared controls, title rows, not-found) and the updated users, diary and tasks screen tests.

## Not checked

- No signed-in browser session was available in this worktree (no credentials), so 360, 375, 390, 768, 1024 and 1280 were **not** looked at in a real browser after the change. The changes are small shared controls with the same 44px targets and logical properties; the risk is the new title row spacing on `/users` and `/diary` desktop, and icon rows wrapping in task cards on 360. Needs a quick pass by someone signed in.
- Cloud tests were not run.
