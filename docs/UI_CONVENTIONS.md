# UI conventions

Every screen uses the shared pieces below. Don't build a local copy; extend the shared one (a serial shared change). Look and tokens: DESIGN (§3.1 tokens, §3.5 headers, §4 shells). Phone is 360-1023, desktop from 1024; both are CSS-switched views of one shared logic layer.

## Layout and headers

- **Top-level route** (`/projects`, `/finance`, `/diary`, `/users`, `/more`): the phone shell header shows the title; on desktop the page renders `DesktopTitle` (same `ui-ph` row, size and place as an inner header; a `h1`, never a local `h2` with its own font size). Content starts right under it. Inside a project the tab is the title: a tab renders no title row.
- **Inner route** (two or more path segments): render `PageHeader` first, on phone and desktop. It has the back arrow (right side in RTL), the title, an optional `badge`, `actions` at the far left, and `sub` for a subtitle. The phone shell header is hidden on inner routes (`isInnerRoute`), so the title appears once. Never use `<h1>` or a text back link by hand.
- **Back target:** a section tab (details, finance, diary of a project) goes back to the list; a sub-page (edit, permissions) goes back to its parent screen. Label it in Hebrew: "חזרה ל...".
- **Page body:** wrap in `Page` (one 16px gap on phone, 20px on desktop). `narrow` caps forms and lists at 820px. No inline `style` for spacing.
- **Project sections:** `ProjectTabs` (phone) and `ProjectInnerNav` (desktop) under the header, on every project screen.

## Filters and search

Every list screen has the same order: the filter row on top (search, dropdowns, date fields; an "archive"-style toggle is a button at the end of that same row, never a checkbox), the data beneath. Filter dropdowns are `SelectField`, dates are `DateField`. `tests/screens/ui/pickers.test.ts` fails if a screen uses a native `<select>` or `type="date"`.

## Pinned top (sticky rule)

Wherever a page scrolls, the title, the project tabs and the screen's primary action row stay pinned to the top, phone and desktop, so nobody scrolls up to act.

- **Header and tabs:** `PageHeader` is pinned by itself (`PinHead`). The project tabs go in as its `children` (see `ProjectFrame`), so title and tabs pin together. Never add a second sticky header.
- **Action row:** wrap a screen's primary actions (add, upload, filter, print, search plus add) in `<Pin>` from `@/components/ui`. It sticks right under the pinned header (`--pin-h`, measured by `PinHead`) or under the phone shell header on top-level routes (`--pin-top`). Never write `position: sticky` in a screen's CSS; `tests/screens/shell/sticky-header.test.ts` enforces it.
- Keep the pinned area compact: one row of buttons, no notices or long text inside `Pin`. A page-level save bar stays `FormActions`. Sheets and dialogs sit above the pinned area (native dialog). The phone bottom nav is unchanged.

## Components

| Need | Use |
| --- | --- |
| Surface | `Card` (`panel` on desktop sections) |
| Buttons | `Button`: `primary` once per screen area, `secondary` for the rest, `danger` only for the confirm button of a destructive action. Targets 44px+. `icon="add"` on every create button |
| Icon-only action | `IconButton` with an icon from `ActionIcons` (see "One language for actions"). Never a local icon or icon-button class |
| Text inputs | `TextField` (label, hint, error under the field; `hideLabel` for compact filter rows) |
| Date | `DateField`: shows DD/MM/YYYY, opens the app's Hebrew calendar (week starts Sunday), value is an ISO string, `name` submits it from a plain form. Never `<input type="date">` or a library picker |
| Dropdown | `SelectField` with `options` (`value`, `label`): menu under the field on desktop, bottom sheet on the phone, keyboard (arrows, Home/End, type-ahead, Enter, Escape). `name` submits the value. Never a native `<select>` |
| Form save bar | `FormActions`: save first, cancel second. `placement="page"` (fixed above the bottom nav on phone, inline on desktop) or `"sheet"` |
| Pop-up | `Sheet` (bottom sheet on phone, centred window on desktop). Never a custom overlay |
| Multi-step creation | `NewProjectWizard` is the pattern: one window (`Sheet`), numbered steps that slide sideways, no scrolling inside a step, back and next in the footer, the record is saved when its last form step is confirmed and later steps apply to the saved record and can be skipped |
| Confirm | `ConfirmDialog` for every cancel, remove, finish or archive. Say what is kept ("שום דבר לא נמחק") |
| Empty, forbidden, error page | `StateMessage` (message plus one way back). A forbidden page shows no data. `notFound()` is fine in a page: `(app)/not-found.tsx` renders the same `StateMessage` inside the shell (status stays 404) |
| Inline message | `Notice` (`error` for failures; shown with text, not colour alone) |
| Status | `Badge` |
| Loading | `loading.tsx` with `PageSkeleton` / `Skeleton` |

## One language for actions (UX-AUDIT)

The same action looks and sits the same on every screen. `tests/screens/ui/one-language.test.ts` fails on a local copy.

| Action | Icon (`ActionIcons`) | Control |
| --- | --- | --- |
| Create / add | plus (`AddIcon`) | primary `Button icon="add"`, label "הוספת ..." / "... חדש". In the pinned action row: far end on desktop, full width on phone. Never "+ " typed into the label |
| Edit | pen (`EditIcon`) | in a row or card: `IconButton`. In a section header on desktop: secondary small `Button` with the pen and the words "עריכת ..." |
| Delete, cancel an entry, remove access | bin (`DeleteIcon`) | in a row: `IconButton tone="danger"`. Always opens `ConfirmDialog` (danger confirm button, "חזרה" to back out), says what is kept, never deletes data (A-12) |
| Print | printer (`PrintIcon`) | prints data only; `IconButton` in a row or on the phone, secondary `Button` with the printer on a desktop toolbar |
| Export | tray with arrow (`ExportIcon`; `ExcelIcon` for the Excel file, Alon's glyph) | downloads a file; a separate control from print, same placement rules |
| Filter | funnel (`FilterIcon`) | secondary `Button` in the pinned row |
| Archive, finish, reopen, restore | none (words) | secondary `Button`, confirmed. Danger only in the confirm window |
| Open / download a document | none | items of the row's action menu (documents), not loose buttons |

- **Order in a row** (right to left): print, export, delete, edit. The destructive icon is never first under the thumb on the phone's left edge.
- **Hierarchy:** one `primary` per screen area (the create button, or the save button of a form). Everything else is `secondary`. `danger` exists only as the confirm button of a destructive `ConfirmDialog`.
- **Phone vs desktop:** the same icon and meaning; the phone shows icons only and full-width create buttons in the pinned row, the desktop adds the words on toolbar buttons. Neither adds a control the other lacks.
- **Forms and windows:** `FormActions` or `ui-actions--sheet`: save first, cancel second ("ביטול"). A window that only shows a result closes with "סגירה". A confirm window backs out with "חזרה".
- **Label:** every icon-only control has a Hebrew `label` (aria-label and tooltip). Row actions name their row ("עריכת תנועה: ...").

## Rules

- RTL first: use logical properties (`margin-inline-start`, `inset-inline`), keep phones, emails and file names in `.ltr`.
- No horizontal scroll at 360, 375, 390, 768, 1024, 1280. Phone has no sidebar and no tab bar (UX-19); the report button stays in the middle.
- Destructive actions are always confirmed and never delete data (A-12).
- Errors from the server are mapped to plain Hebrew (`errorText`); never show raw messages.
- A route that renders both views renders each once; the other is hidden with `m-only` / `d-only`.

## Loading and speed

- **Skeletons only on data (SKELETON-DATA).** Page chrome (title, back link, project tabs, action row, filters, buttons) is never a skeleton and never disappears while data loads. Every route group has a `loading.tsx` and an `error.tsx` (`RouteError`). A `loading.tsx` is `PageSkeleton bare` (or `frame` / `InnerPageSkeleton` below) (cards shaped like the data) plus, where the real screen has them: `title` (static desktop title, rendered for real), `heading` (static section heading), `bar={[widths]}` (the action row's controls, same count and size as the real row; desktop only, because the phone rows differ). Never a header-row skeleton or `tabs`. Inner routes (edit, permissions, reports) use `InnerPageSkeleton` (real `PageHeader` and back link at once). Entering a project uses `PageSkeleton frame` (real back link, placeholders only for name and tabs). When you add or change a screen's title or action row, change its `loading.tsx` to match. `tests/screens/shell/loading-structure.test.ts` enforces this.
- **Project tabs:** a new tab (documents, diary, ...) is a route under `src/app/(app)/projects/[id]/(tabs)/<name>/` with its own `page.tsx` and a content-only `loading.tsx` (`<PageSkeleton bare ...>`). Never add a tab route beside `(tabs)` and never add a header or tab skeleton inside it: the frame (header, tabs) lives in `(tabs)/layout.tsx` and must stay mounted while only the content loads and slides. Add the tab to `sectionsFor` in `view-model.ts` at its place in the order (details, documents, tasks, diary, finance): `tab-motion` derives the slide direction from that order (a later tab enters from the left in RTL). `tests/screens/projects/tab-navigation.test.ts` enforces this. Check tab switching on `next build && next start` or on `localhost`. `next dev` can be opened through `localhost`, `127.0.0.1` or a LAN address (`allowedDevOrigins` in `next.config.ts`, dev only); without it the client never hydrates, buttons stay dead and every tab click is a full page load. Over plain `http://<LAN address>` (a phone) the browser has no `crypto.randomUUID`, so screens that create a request id still crash there: test on a phone against `next build && next start` behind https or against the deployed site.
- Read once per request: get identity and platform from `components/shell/request.ts` (`getContext`, `getPlatform`), never `createPlatform()` in a page or layout. Run independent reads with `Promise.all`; no sequential awaits that don't depend on each other.
- Lists fully loaded on the page (a month of finance rows, members) are searched and filtered on the client with no round trip; ask the server only for numbers the client can't compute.
- Toggles, role and permission changes are optimistic: update the row at once, roll back and show an error toast if the action fails (see `AccessManager`). Writes still only go through actions.
- Navigation: use `next/link` (prefetches the skeleton). The client router cache holds a page for 30 seconds (`staleTimes` in `next.config.ts`); a server action refreshes it. Don't raise it without Alon.
- No server cache across requests (`unstable_cache`, `use cache`, `revalidate`): reads depend on the actor and on per-project permissions, and finance must never reach a role without access. `tests/shell/cache-safety.test.ts` enforces it.
- Measure with `next build && next start`, not `next dev`; compare before and after in the task file.

## Print and export

Two separate actions, never one combined "print / PDF" control.

- **Print** opens a clean print view of the data only: finance prints the `PrintView` (`window.print()`); a diary entry or day opens its PDF inline in a new tab. A global `@media print` rule in `app.css` hides the pinned header, project tabs, every `Pin` action row, `.no-print`, the shell header, nav and sidebar. Mark any new screen chrome `no-print`. A4, RTL, no cut-off columns.
- **Export** downloads a file: Excel for finance, `?download=1` PDF for the diary. Label it "ייצוא".
- The diary PDF needs a browser: Chromium on Linux (Vercel); on macOS/Windows the installed Chrome (or `REPORT_CHROME_PATH`).

## Uploads

- Uploading starts the moment a file is picked. There is no separate "upload" button; use `FileUpload` and never build another picker.
- Each file shows progress, success, or an error with "retry" and "remove". Only completed files are handed to the form, so a retry never attaches a duplicate.
- A form with an upload passes `onBusyChange` and blocks submit (and a document sheet blocks close and edits to its choices) while a file is in flight.
- If a file needs a mandatory choice (document category and access), the choice comes first and the picker stays locked until it is valid. Never default it.

## UI checklist (before "done")

Back and title via `PageHeader`; primary action row in `Pin`; shared components only; `loading.tsx` present; 360-1280 in RTL with no horizontal scroll; confirm on destructive actions; forbidden state shows no data.
