# UI conventions

Every screen uses the shared pieces below. Don't build a local copy; extend the shared one (a serial shared change). Look and tokens: DESIGN (§3.1 tokens, §3.5 headers, §4 shells). Phone is 360-1023, desktop from 1024; both are CSS-switched views of one shared logic layer.

## Layout and headers

- **Top-level route** (`/projects`, `/more`...): the shell shows the title (phone `MobileHeader`, desktop breadcrumb). Content starts right under it.
- **Inner route** (two or more path segments): render `PageHeader` first, on phone and desktop. It has the back arrow (right side in RTL), the title, an optional `badge`, `actions` at the far left, and `sub` for a subtitle. The phone shell header is hidden on inner routes (`isInnerRoute`), so the title appears once. Never use `<h1>` or a text back link by hand.
- **Back target:** a section tab (details, finance, diary of a project) goes back to the list; a sub-page (edit, permissions) goes back to its parent screen. Label it in Hebrew: "חזרה ל...".
- **Page body:** wrap in `Page` (one 16px gap on phone, 20px on desktop). `narrow` caps forms and lists at 820px. No inline `style` for spacing.
- **Project sections:** `ProjectTabs` (phone) and `ProjectInnerNav` (desktop) under the header, on every project screen.

## Components

| Need | Use |
| --- | --- |
| Surface | `Card` (`panel` on desktop sections) |
| Buttons | `Button`: `primary` once per screen area, `secondary` for the rest, `danger` only for the confirm button of a destructive action. Targets 44px+ |
| Text inputs | `TextField` (label, hint, error under the field) |
| Form save bar | `FormActions`: save first, cancel second. `placement="page"` (fixed above the bottom nav on phone, inline on desktop) or `"sheet"` |
| Pop-up | `Sheet` (bottom sheet on phone, centred window on desktop). Never a custom overlay |
| Multi-step creation | `NewProjectWizard` is the pattern: one window (`Sheet`), numbered steps that slide sideways, no scrolling inside a step, back and next in the footer, the record is saved when its last form step is confirmed and later steps apply to the saved record and can be skipped |
| Confirm | `ConfirmDialog` for every cancel, remove, finish or archive. Say what is kept ("שום דבר לא נמחק") |
| Empty, forbidden, error page | `StateMessage` (message plus one way back). A forbidden page shows no data |
| Inline message | `Notice` (`error` for failures; shown with text, not colour alone) |
| Status | `Badge` |
| Loading | `loading.tsx` with `PageSkeleton` / `Skeleton` |

## Rules

- RTL first: use logical properties (`margin-inline-start`, `inset-inline`), keep phones, emails and file names in `.ltr`.
- No horizontal scroll at 360, 375, 390, 768, 1024, 1280. Phone has no sidebar and no tab bar (UX-19); the report button stays in the middle.
- Destructive actions are always confirmed and never delete data (A-12).
- Errors from the server are mapped to plain Hebrew (`errorText`); never show raw messages.
- A route that renders both views renders each once; the other is hidden with `m-only` / `d-only`.

## Loading and speed

- Every route group has a `loading.tsx` that mirrors its layout (`PageSkeleton`) and an `error.tsx` (`RouteError`). A new route with its own data adds its own `loading.tsx` with the same shape as the page, so nothing shifts.
- **Project tabs:** a new tab (documents, diary, ...) is a route under `src/app/(app)/projects/[id]/(tabs)/<name>/` with its own `page.tsx` and a content-only `loading.tsx` (`<PageSkeleton bare ...>`). Never add a tab route beside `(tabs)` and never use `PageSkeleton tabs` or a header skeleton inside it: the frame (header, tabs) lives in `(tabs)/layout.tsx` and must stay mounted while only the content loads and slides. Add the tab to `sectionsFor` in `view-model.ts` at its place in the order (details, documents, tasks, diary, finance): `tab-motion` derives the slide direction from that order (a later tab enters from the left in RTL). `tests/screens/projects/tab-navigation.test.ts` enforces this. Check tab switching on `next build && next start` or on `localhost`. `next dev` can be opened through `localhost`, `127.0.0.1` or a LAN address (`allowedDevOrigins` in `next.config.ts`, dev only); without it the client never hydrates, buttons stay dead and every tab click is a full page load. Over plain `http://<LAN address>` (a phone) the browser has no `crypto.randomUUID`, so screens that create a request id still crash there: test on a phone against `next build && next start` behind https or against the deployed site.
- Read once per request: get identity and platform from `components/shell/request.ts` (`getContext`, `getPlatform`), never `createPlatform()` in a page or layout. Run independent reads with `Promise.all`; no sequential awaits that don't depend on each other.
- Lists fully loaded on the page (a month of finance rows, members) are searched and filtered on the client with no round trip; ask the server only for numbers the client can't compute.
- Toggles, role and permission changes are optimistic: update the row at once, roll back and show an error toast if the action fails (see `AccessManager`). Writes still only go through actions.
- Navigation: use `next/link` (prefetches the skeleton). The client router cache holds a page for 30 seconds (`staleTimes` in `next.config.ts`); a server action refreshes it. Don't raise it without Alon.
- No server cache across requests (`unstable_cache`, `use cache`, `revalidate`): reads depend on the actor and on per-project permissions, and finance must never reach a role without access. `tests/shell/cache-safety.test.ts` enforces it.
- Measure with `next build && next start`, not `next dev`; compare before and after in the task file.

## UI checklist (before "done")

Back and title via `PageHeader`; shared components only; `loading.tsx` present; 360-1280 in RTL with no horizontal scroll; confirm on destructive actions; forbidden state shows no data.
