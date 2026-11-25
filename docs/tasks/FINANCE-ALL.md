# FINANCE-ALL — the all-projects finance page

Alon, 24.11.2026: `/finance` must look and behave like a project's finance tab (filters, search, print, export, totals), over all movements of all projects, with no project tabs. Branch `claude/funny-matsumoto-89cd23`. No migration, service, cost or deployment.

## Changed

- `/finance` now renders the same `FinanceMobile` / `FinanceDesktop` / `PrintView` as the project tab (shared, not copied): period switch, summary, pinned action row (`Pin`), search, filter popover, chips, month table, print (`window.print()`, print view only) and a separate Excel export. Differences: a "פרויקט" column (phone: project label under the details), a project dropdown (`SelectField`, capped width; in the phone filter sheet), no add/edit/cancel, no Excel-link field, no "view only" notice, no tabs.
- Data: `features/overview/logic/finance-all.ts` (`getAllFinance`, owner only): rows read through RLS from `transactions`; month figures are the per-project rounded summaries from `getAllProjectTotals` (RPC `finance_all_month_totals`) added up, so tax = sum of per-project taxes (A-07). Work days from the existing `diary_summary`. Totals respect period, day, search and project. No new database function.
- Export: `/finance/export` (route inside the owned folder), same filters, project name prefixed to each row's details in the workbook; owner only.
- Shared change (no behaviour change for a project): `FinanceNavProvider` takes an optional `all` scope and exposes `href()`/`goProject()`; `query.ts` got `allFinanceHref`/`allExportHref`; `finance.css` three small rules.
- Kept the P2.7 transfer summary (tax per month with project breakdown) as a section under the page, only for the whole period with no project, day or search chosen (`TransferMobile/Desktop` got an `embedded` prop). It does not conflict with the per-project look.
- Visibility: owner only (P29 stays: a manager with finance on every project still gets no all-projects page, as before). Non-owner: plain 404, nothing read; unknown project id: 404.
- `loading.tsx`: title plus the action-row bar, cards only for data.

## Checked

- `tsc` clean, eslint clean on touched folders.
- `vitest --project unit tests/screens tests/shell tests/logic/finance-export`: 30 files, 321 tests pass. New `tests/screens/finance/all-projects.test.ts` (8): sums over projects, search/day totals, project filter, unknown project, non-owner refused on the server with no read, hidden load, rendered screen (project column, project filter, export link separate from print, no add/link controls).

## Not checked / open

- No signed-in browser pass and no 360–1280 screenshot check (no session; cloud tests need a window and Alon's yes). Layout reuses the project page's CSS; added rules only cap the project field width.
- Real-data cloud run of `getAllFinance` not done.
- Reviewer (Sonnet): approved, no blocking findings; the tax summary now hides while day/search is active.

## Round 2 — add, edit, cancel, permanent delete from `/finance` (25.11.2026, branch `claude/finance-all-write`)

- **Add / edit / cancel** reuse the project tab's `EntryForm`, `EntrySheet` and `CancelConfirm` (same commands). `getAllFinance` now returns `canWrite`/`canCancel` true (the page is owner only). "הוספת תנועה" sits in the same pinned row as on the project tab (phone `Pin`, desktop filter bar).
- **Project picker (new):** `EntryForm` takes optional `projects`. A new entry shows a required "פרויקט" `SelectField`, empty by default (preselected only when the page is already filtered to one project) and listing only projects that accept finance (active, not archived). Editing shows the row's own project, disabled. Without `projects` (project tab) nothing changes.
- **Row actions:** the shared `IconButton` edit and delete icons; on a row of a finished or archived project they are not shown (the database also refuses). New `useFinanceNav().rowProjectId/rowOpen`.
- **Permanent delete (A-44):** the project tab lists no cancelled transactions, so there was nothing to hang it on. `/finance` now has a collapsed section "תנועות מבוטלות (N)" (owner page, period and project filters apply, in no total, hidden when printing) with "מחיקה סופית" per row, using the shared `HardDeleteDialog` (`kind="transaction"`: server preview, irreversible notice, owner and cancelled only, enforced by the database function). Refreshes the page after.
- Result appears at once: the same `router.refresh()` as the project tab reloads rows and totals.
- No migration, service or cost. The PRODUCTION database was not touched: no cloud test ran.

### Checked

- tsc, eslint clean; `vitest --project unit tests/screens tests/shell tests/logic`: 67 files, 983 tests pass. New: cancelled rows and project ids from `getAllFinance`, add button and per-row actions only for open projects, picker empty and required, edit project disabled, cancelled section with permanent delete, non-owner refused with nothing read.
- Server rules (manager without finance, worker, finished project) are the existing database functions behind `create_transaction` / `update_transaction` / `cancel_transaction` / `hard_delete_transaction`; their tests exist (`tests/db/hard-delete.test.ts`, finance and role-matrix suites) and were not re-run (cloud).

### Not checked / open

- The picker has no text search: `SelectField` has none (shared component, not mine). It has type-ahead; a search box is a shared change if Alon wants it with 40+ projects.
- No signed-in browser pass at 360–1280, no cloud run.
- Reviewer (Sonnet): approved. Fixed: a new entry preselects the filtered project only if it is open. Permanent delete is also offered for cancelled rows of finished projects (the database function decides; allowed by A-44 for any cancelled transaction).

## Round 3 — month rows instead of the bottom table (25.11.2026, branch `claude/finance-month-rows`)

- Alon: the "פירוט חודשים" table under the main table added nothing. Removed it from the shared desktop finance screen (so the project tab matches). For the whole period, the main table is now split by month: a month row (month name linking to that month, net profit and month balance, income, total expense) followed by that month's movements, newest month first. A single-month view has no month rows (its summary is above). Day/search narrowing hides months with no matching rows. Phone is unchanged (its month list already was the summary).
- Checked: tsc, eslint, `tests/screens tests/shell` pass (new assertion: no "פירוט חודשים", month rows present). Not checked: browser at 1024/1280, print (print view already has month rows).
