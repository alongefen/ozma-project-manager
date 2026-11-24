# HEADER-LOGO: company logo in the phone header

24.11.2026. Request from Maor via Alon. No migration, service, cost, dependency or deployment.

## Changed
- New `HeaderLogo` (`src/components/ui/PageHeaderLogo.tsx`): `/brand/logo.webp`, 62x30 (file is 690x334), Hebrew `alt` "חי עוצמה בבנייה", `loading="eager"`, `decoding="sync"`, `fetchPriority="high"`, class `m-only` (hidden from 1024). Not a link.
- `MobileHeader` (top-level routes): title on the right, then at the left an end group of account avatar (non-owners) and the logo. The logo is the leftmost element; the account stays visible next to it.
- `PageHeader` (inner routes, phone): logo is the last item of the row, after `actions`. With no actions it takes the free space (`margin-inline-start:auto`), so it is still at the far left. Title size and place unchanged; the logo never shrinks, so a long title wraps instead of overlapping it.
- CSS in `app.css` (`.ui-hlogo`, `.m-header__end`, `.ui-ph__logo`). Docs: one bullet in UI_CONVENTIONS "Layout and headers". Test: `tests/screens/shell/header-logo.test.ts`.

## Checked
- vitest `--project unit tests/screens`: 194 pass (4 new); `tsc` and `eslint` clean; `npm run build` passes.
- Real browser on a static page with the real `app.css` and the same markup (shell header with account + logo, inner header with a long title and an action button, inner header without actions): at 360, 375, 390 no horizontal scroll, logo at the left edge, 30px tall, long title wraps; at 1280 the logo is `display:none`.
- Contrast: the logo is on white `--surface`, same as the sign-in screen.

## Not checked
- No signed-in session, so the real app screens were not seen in a browser (only the static page above).
- 768 and 1024 not viewed (CSS switches at 1024 with the existing `m-only`).
- React hoists a `<link rel=preload>` for the logo (from `fetchPriority="high"`), so desktop also preloads the file the sidebar uses anyway.
