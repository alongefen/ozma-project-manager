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
