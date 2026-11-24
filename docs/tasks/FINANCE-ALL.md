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
