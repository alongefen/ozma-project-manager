# PRINT-EXPORT

Direct requests from Alon, 24.11.2026: finance print shows tabs and chrome; diary print/PDF opens `{"ok":false,"error":{"code":"UNAVAILABLE",...}}`; separate export from print.

## Root cause (UNAVAILABLE)

`renderHtmlToPdf` (`src/features/reports/logic/rendering/render.ts`) threw on any non-Linux machine unless an `executablePath` was passed, and no caller passed one. The throw was swallowed by `guarded()` in `service.ts` and mapped to `UNAVAILABLE`, so the route returned the JSON error for both a single entry and by-date. Reproduced on macOS (Darwin): `Chromium הארוז דורש Linux; ...`. Same cause for both flows (same `renderReportPart`).

Not verified: the deployed Vercel (Linux) behaviour. If it still fails there, the new server logs (`[reports] render failed: <message>`) show the real error; a cause in env, storage or cost goes back to the project manager (D31).

## Changes

- `render.ts`: on non-Linux the installed Chrome/Chromium/Edge is found automatically (`REPORT_CHROME_PATH` overrides). Linux unchanged (packaged Chromium).
- `service.ts`, `api/reports/diary/route.ts`: log the real error message server-side (never sent to the client).
- Print: global `@media print` in `app.css` hides pinned header and project tabs, `Pin` rows, `.no-print`, shell; finance print gets `@page` A4 and a full-width table.
- Export vs print: diary entry card has a print icon (inline PDF) and a separate export icon (download); by-date sheet "הדפסה וייצוא לפי תאריך" has "הדפסה" and "ייצוא PDF" per part. Finance already had separate Excel export and print buttons; unchanged.
- Docs: UI_CONVENTIONS "Print and export".
- One line added to `src/styles/app.css` (shared file, print block only).

## Checks

- Unit: `tests/screens` and `tests/logic/reports`, `finance-export` pass (656 passed); tsc and eslint clean. New: `tests/logic/reports/rendering/local-browser.test.ts` (real PDF with no path on this Mac), `tests/screens/shell/print-rules.test.ts`, diary render test updated.
- Server refusals unchanged: route and service refusal tests pass (not allowed role, no access, finished project).

## Not checked / open

- Real signed-in browser and print preview at 360-1280 (no session available); the print CSS is checked by source tests only.
- `reports.cloud.test.ts` not run (needs a cloud window and Alon's yes).
- Deployed Vercel PDF not checked.
