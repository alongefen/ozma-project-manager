# NEW-REPORT-CONTEXT (bug fix, 24.11.2026)

**Report (Alon):** after using "דיווח חדש" inside project A, going back to the projects list and pressing it again opened the popup for A and moved to A's page.

## Root cause
`/diary/new` decided the project on the server from the `Referer` header and redirected to `/projects/<id>/diary?new=1`. The menu link is a prefetched `next/link`: the redirect computed while the person was in project A was cached in the client router cache and replayed later from the projects list. The context was effectively remembered, not derived from the current location.

## Fix
- `reportHref(pathname)` / `navHref(item, pathname)` in `src/lib/navigation.ts`: on `/projects/<uuid>/...` the report button links straight to `/projects/<uuid>/diary?new=1`; everywhere else to `/diary/new`. Computed from `usePathname()` in `BottomNav` (phone) and `DesktopSidebar` (desktop). Nothing is stored.
- `/diary/new` no longer reads the referrer: always the general diary with the popup open and no project preset (the person picks the project). `projectFromReferrer` removed.
- `DiaryProvider` click interceptor also handles the project button when that project's diary is already on screen (`?new=1` on the current path), so reopening after close works without navigation.
- Closing or saving already clears `?new=1` via `replaceState`; refresh/back derive from the URL only.
- Server permissions unchanged: the form still gets only projects the person can report on.

## Checks
- `tests/shell/navigation.test.ts`: A → list → B → list sequence gives A's diary, general, B's diary, general; other items unchanged. 63 tests in `tests/shell` + `tests/screens/diary` pass; tsc and eslint clean.

## Not checked
- Not seen live in a browser (no signed-in session here); phone 390 / desktop 1280 not visually checked.
