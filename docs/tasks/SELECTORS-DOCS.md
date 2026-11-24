# SELECTORS-DOCS: shared date and dropdown selectors, documents page pattern

## What changed
- New shared components in `src/components/ui`: `DateField` (DD/MM/YYYY display, Hebrew calendar, week starts Sunday, ISO value, keyboard: arrows, PageUp/PageDown, Home/End, Enter, Escape) and `SelectField` (listbox: arrows, Home/End, type-ahead, Enter, Escape). Both use a native popover (top layer, never clipped by a scrolling sheet): a menu under the field on desktop, a bottom sheet on the phone (below 1024px). `name` submits a hidden input, so plain GET forms keep working. Pure date logic in `calendar.ts`. No new dependency (the old pickers were the browser's native controls).
- `TextField` got `hideLabel` (screen-reader-only label for compact filter rows).
- Replaced: project form and new-project wizard (start/end date), task form (due date), diary filter bar (project, from, to), diary entry form (project, work date), finance entry form (month, year, kind), finance filters (month, year), desktop finance filter panel (month, year).
- `PrintByDate.tsx` converted after PRINT-EXPORT merged. Nothing is left out.
- Follow-up: `SelectField` has a free search box at the top of the open list (filters labels). It is not focused on open, so the phone keyboard opens only when the field is tapped; desktop type-ahead on the list still works.
- Documents page: one filter row (search, category `SelectField`, "לארכיון" button at its end, owner only, `aria-pressed`, shows the archived count), list beneath. Desktop: the row is pinned next to the upload button, no category column. Phone: pinned upload button, then the same row. The archive checkbox and the phone category screen are gone; behaviour (toggle archive view, access rules, upload flow) unchanged.
- `docs/UI_CONVENTIONS.md`: components table and a "Filters and search" section.

## Checked
- `npx tsc --noEmit`, `eslint --max-warnings 0` on src and tests/screens: clean.
- `vitest --project unit tests/screens tests/shell`: all passed (new `tests/screens/ui/pickers.test.ts`: calendar logic, markup/hidden-input values, guard against native date/select; updated files render test: archive is a button at the end of the filter row, no checkbox).
- Real browser, on a temporary harness page with the real components (not committed): phone 360/390 (bottom sheet for dropdown and calendar, no horizontal scroll, filter row fits), desktop 1280 (calendar menu under the field), keyboard (arrow/Enter selection, focus back to the field), picker inside a `Sheet`.

## Review
- One reviewer pass. Fixed: clicking an open field to close it no longer reopens it; month buttons keep focus; project forms use a plain setter. Left as is (low): `role=grid` cells are buttons (not a full grid pattern); native `required`/min/max of the old date input is gone (server and JS validation still apply).

## Not checked
- A signed-in session with real screens (no env/cloud window): the actual forms and the documents page were not opened in a browser. 375, 768, 1024 not opened separately (same CSS breakpoint as 390 / 1280).
- Cloud tests (not needed: no logic, data or permissions changed).
- Dropdown/calendar inside the finance popover and screen-reader behaviour were reasoned about, not exercised.
