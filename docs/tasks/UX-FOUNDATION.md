# UX-FOUNDATION: one product, fast

23.11.2026. Serial shared change. No migration, service, cost, dependency or deployment. Rules for next screens: [UI_CONVENTIONS](../UI_CONVENTIONS.md).

## Audit: divergences found and the convention chosen

| # | Divergence (merged screens) | Convention |
| --- | --- | --- |
| 1 | Back: arrow in `BackTitle` (project), arrow in `fin-back` (finance phone), text link `‹ חזרה לפרויקטים` (finance desktop), none on new/edit, plain text links on error states | `PageHeader` everywhere: arrow-only back on the right, same size |
| 2 | Title: phone showed the shell title ("פרויקטים") above the page's own title; new/edit had a title on desktop only and none on phone; finance used its own `fin-mtitle` / `ui-page-title` | Shell header hidden on inner routes; `PageHeader` is the only title, phone and desktop |
| 3 | Two pop-up implementations (`Sheet` dialog and finance `EntrySheet`) with different animation, close button and focus handling | One `Sheet` in `components/ui`; `EntrySheet` is a thin wrapper |
| 4 | Confirmations: inline box (archive, finish, remove access) vs sheet (cancel transaction) | `ConfirmDialog` for all |
| 5 | Save bars: three copies in `ProjectForm`, another in finance entry | `FormActions` (page / sheet) |
| 6 | Danger button styled per feature (`fin-danger`, `css.danger`) | `Button variant="danger"`, confirm button only |
| 7 | Error/forbidden pages: ad-hoc Notice plus a text link | `StateMessage` |
| 8 | Page spacing by inline `style` | `Page` / `Page narrow` |
| 9 | Two requests did the same auth lookup twice (layout and page) | per-request memo `components/shell/request.ts` |
| 10 | No `loading.tsx` / `error.tsx` anywhere: every navigation waited on the server with the old screen frozen | skeletons and error boundaries per route group |

Left as is (documented): `ProjectTabs` (phone) and `ProjectInnerNav` (desktop) stay two components by design (different looks, A-02/A-23); both views of a screen are still rendered in the DOM and CSS-switched.

## Changed

`src/components/ui/{PageHeader,Page,StateMessage,Skeleton,FormActions,ConfirmDialog,Sheet}`, `Button` danger, `styles/app.css`, `components/shell/{inner,request,RouteError}`, `MobileHeader`, loading/error files under `(app)`, `(app)/projects/[id]`, `.../finance` and `(auth)`, `next.config.ts` `staleTimes`; P2.2/P2.6 views switched to the shared pieces; `BackTitle` and the finance sheet/back CSS removed.

## Checked

- `tsc`, `eslint` clean, `next build` passes, `vitest --project unit`: 785 pass (new: `tests/shell/inner-route.test.ts`, `tests/shell/cache-safety.test.ts`).
- **Cloud run** (owner, existing fake projects, read-only; production build `next build && next start` on both sides; baseline = `origin/main` `6c06ce8`; Chrome headless, 3 runs each, medians; DB round trip from this machine is about 100-130 ms per call):

  | Action (desktop 1280) | Before: first feedback / done | After: first feedback / done |
  | --- | --- | --- |
  | Open project (full page load) | 1.2 s / 1.2 s | 1.1 s / 1.1 s (no change, server bound) |
  | Switch to finance tab | 1.1 s / 1.1 s (old screen frozen) | 0.15-0.27 s skeleton / 1.0 s |
  | Back to details (visited) | 0.03 s | 0.03 s |
  | Finance tab again (visited) | 0.03 s | 0.13 s (skeleton first; now 130 ms instead of 30 ms, accepted) |
  | Permissions page | 1.7-2.1 s | 1.0-1.2 s (project and both lists now load in one stage) |
  | Phone (390): bottom nav to /more | 0.34 s | 0.06 s skeleton / 0.36 s |

  Phone tab switch matches desktop. Filter and search on finance were already local (no round trip); permission toggles were already optimistic with rollback, so not changed and not re-measured (they write to the DB).
- **Remaining floor:** the finance page needs about 1.0 s, roughly eight sequential Supabase calls (`getUser`, `get_actor`, then the book). Cutting it needs server logic (merge identity into one call, or run `getBook` queries in parallel), which is out of scope here: **for the project manager.**
- **Layout check** (owner session, 6 routes x 360/375/390/768/1024/1280, RTL): no horizontal overflow anywhere; exactly one visible `h1` and one back arrow on every inner route, phone and desktop; the phone shell header is hidden on inner routes. Screenshots at 390 and 1280 inspected for finance.
- **Not checked:** permission-toggle timing (would write to the shared DB), `/more` desktop has no `h1` (pre-existing), print stylesheet, no forbidden-role session available (only the owner login), so "finance hidden for non-authorised roles" rests on the unchanged `tests/screens/finance/hidden.test.ts` and the cache-safety test.
