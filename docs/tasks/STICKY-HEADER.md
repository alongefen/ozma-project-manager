# STICKY-HEADER: header, tabs and action buttons stay pinned

23.11.2026. Serial shared change (Alon's request). No migration, service, cost or deployment.

## Changed

- `PageHeader` now wraps itself in new `PinHead` (client, sticky, publishes its height as `--pin-h` on its parent via `ResizeObserver`) and accepts `children` that pin under the title row. `ProjectFrame` passes the address line and the phone `ProjectTabs` / desktop `ProjectInnerNav` as those children, so title and tabs pin together on every project tab.
- New `Pin` (`components/ui`): sticky action row under the header (`top: --pin-top + --pin-h`). `--pin-top` is the phone shell header height on top-level routes, 0 on inner routes and on desktop (the desktop shell header scrolls away).
- Adopted by wrapping, no restructuring: diary toolbar (phone and desktop) and desktop title/new-report row, files (desktop bar, phone upload), tasks (desktop bar, phone new note), finance (phone add/filter, desktop filter+add bar), users toolbar. The diary's own sticky CSS (`dr-toolbar`, `--under`) was removed in favour of `Pin`.
- Docs: new "Pinned top" section in UI_CONVENTIONS. Test: `tests/screens/shell/sticky-header.test.ts`.

## Checked

- `tsc`, `eslint` clean; `vitest --project unit tests/screens`: 120 pass (5 new).
- CSS mechanism in a real browser on a static page that uses the real `app.css` and the same markup: after scrolling, the header block sits at y=0 and the action row directly under it with no overlap. The browser pane reported width 0, so no per-width check.

## Not checked (open)

- A signed-in session on real project pages was not available (no credentials), so 360-1280 on each tab, home, finance and workers is **not** verified in a browser. Needs a quick manual pass by someone signed in.
- Not pinned on purpose: the "permissions" link on project details (rare, one link), the desktop finance export/print row, in-card edit buttons. Home and projects list have no action buttons in this branch (PR #77 owns the index).
- Print: pinning is turned off in `@media print`.
