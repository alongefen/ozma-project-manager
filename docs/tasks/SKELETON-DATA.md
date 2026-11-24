# SKELETON-DATA: skeletons only where the data is

24.11.2026. Alon's request (desktop). Serial shared change. No migration, service, cost, dependency or deployment.

## Found

- `(app)/loading.tsx` (fallback for /projects and others) drew a fake header row (back square + title bar): the real page has no such header on top-level routes, so the whole top flashed.
- Every list screen's `loading.tsx` was cards only, while the real screen has a title and an action row (search, filters, upload, new). Those vanished and came back on each navigation.
- Entering a project showed a fake header and tab bar instead of the real back link.
- Edit, permissions and report screens had no `loading.tsx` of their own and fell back to the fake header.
- Tab switching inside a project already kept the frame (layout) mounted; only the tabs' own action rows were missing from their skeletons.

## Changed

- `PageSkeleton`: new `title`, `heading`, `bar` (mirror static chrome and the action row), `frame` (real project header with name/tabs placeholders); the fake header row and `tabs` are gone from use. New `SkeletonBar`, `InnerPageSkeleton` (real `PageHeader` + back link), `PageHeader` title accepts a node. Small CSS in `app.css`.
- `loading.tsx` rewritten for projects, finance, diary, diary/new, users, project entry, project tabs (files, tasks, diary, finance), and new ones for projects, edit, edit/access, reports/diary. `(app)/loading.tsx` is content-only.
- UI_CONVENTIONS loading rule rewritten. Test: `tests/screens/shell/loading-structure.test.ts`.

## Checked

- `tsc`, `eslint` clean; `vitest --project unit tests/screens`: 144 pass (new test included).

## Not checked / open

- No signed-in session, so not verified in a browser at 360-1280 (neither desktop nor phone). The mirrored bars use approximate widths; a quick visual pass for layout jump on arrival is needed.
- Mirrored titles/action rows in `loading.tsx` are visually identical copies, not the same mounted elements (they are inside the data components, which need the data and providers). Moving them out would mean splitting each provider; not done.
- Phone has no mirrored chrome other than the shared bar row; phone shell title/bottom nav were already static.
