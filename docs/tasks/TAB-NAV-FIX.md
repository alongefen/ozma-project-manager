# TAB-NAV-FIX: project tab navigation

Serial shared change. Owner: task session. Base: `origin/main` `7a7b836`.

## Root cause
- The tab-switch regression did **not** reproduce on `localhost`: on `main` `7a7b836` (production build, dev server on `localhost`, and Alon's own dev server on `localhost:3000`) the header and frame stay mounted, only the content skeleton shows, the slide direction is right. No route or component change was needed.
- The full-skeleton, no-slide symptom is what you get from `next dev` opened through `127.0.0.1` or a LAN address (a phone): Next blocks `/_next/hmr` as cross-origin, the client never hydrates, so every tab click is a full document load. Fixed with `allowedDevOrigins` (dev only).
- The separate "dead in-page buttons" report was Opera; in Chrome everything works. Browser or extension issue, no code change.

## Changes
- `next.config.ts`: `allowedDevOrigins` for 127.0.0.1 and the private LAN ranges (PM approved this one edit).
- `tests/screens/projects/tab-navigation.test.ts`: route-structure guard (tabs only under `(tabs)`, content-only `loading.tsx` per tab, frame in the tabs layout, no header skeleton inside tabs) and the full slide-direction matrix over the tab order.
- `docs/UI_CONVENTIONS.md`: rule for new project tabs and how to view dev from a phone.

## Open finding (outside this task's files)
- Over plain `http://<LAN address>` browsers have no `crypto.randomUUID` (secure contexts only). It is called during render in `TasksProvider`, `NewProjectWizard`, `ProjectForm`, `UsersManager`, `EntryForm`, `FileUpload`, so those screens crash on a phone against a LAN dev server even after the fix above. Suggested serial change: one `newRequestId()` helper with a fallback, used in those files.

## Checked
- Real browser (headless Chromium, owner, existing fake project, read-only), 390 and 1280, Hebrew RTL: production `next build && next start` and dev (`localhost`, and `127.0.0.1` after the fix). Header never replaced, no full skeleton, slide direction correct for every hop (details, finance, tasks, back, tab to details), visited tabs show no skeleton, no horizontal scroll. Also with a 32 s pause (router cache expired), `router.refresh()`, 1.5 s delayed RSC, and client-side or hard entry.
- Before the fix, dev via `127.0.0.1` lost a window marker on every tab click (full document load); after it the marker survives and "+ משימה חדשה" opens its dialog.
- Not checked: 360 and 768/1024 widths by hand (the reviewer covers 360), `http://<LAN address>` (crashes on `crypto.randomUUID`, see above), real Safari and Opera.
- `tsc`, `eslint`, unit tests: pass (830).
