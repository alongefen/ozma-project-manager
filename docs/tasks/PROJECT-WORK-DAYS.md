# PROJECT-WORK-DAYS: project diary work-day counter

## Approved design — Alon, 26.11.2026
Display `ימי עבודה שדווחו: N` in the project diary, phone and desktop. Use the existing date filter; no date range means all dates in that project. Count unique report work dates, not entry timestamps or number of reports. Multiple reports on one date count once. Cancelled reports do not count. This is reported activity, not weekdays/calendar business days.

## Approach
Reuse `DiaryApi.getSummary(ctx, { projectId, from?, to? })`, which returns `workDays` through existing `diary_summary`. Source implementation uses distinct work_date, excludes cancelled entries and respects RLS. Prefer this complete server aggregate over counting the loaded 50-row page or downloading all reports. No new filter, migration, dependency or global-diary counter. Existing filters stay unchanged. Show the count near the diary controls, outside the compact pinned action row (UI_CONVENTIONS).

## Ownership and dependencies
Owned: `src/features/diary/shared/{load.ts,types.ts,DiaryProvider.tsx,DiaryToolbar.tsx,diary.css,WorkDays.tsx}`, `src/features/diary/{mobile/DiaryMobile.tsx,desktop/DiaryDesktop.tsx}`, `tests/screens/diary/**`, this file. Other files need a serial shared change. Read logic/actions.ts and logic/queries.ts without changing contracts/SQL. No overlap with upload implementation or lockfile task. Green CI may wait for UPLOAD-LOCKFILE. Reviewer model issue from A-39 is unresolved; do not invent a waiver.

## Implementation plan
- [x] In `tests/screens/diary/work-days.test.ts`, add failing loader/UI cases: fixed project with active date range passes the exact filter to getSummary; summary 12 with a partially loaded page still displays 12; zero displays 0; general diary makes no new summary request and has no counter; failure never masquerades as zero. Run the affected Vitest unit files with quiet output; confirm red before implementation.
- [x] In shared/load.ts load the existing summary concurrently for fixed-project diary only, through the authenticated server context. Extend DiaryScreen with optional project counter state in shared/types.ts. Respect hidden/signed-out behavior; never expose a count for an inaccessible project. Do not hydrate all report pages to compute it.
- [x] Add shared/WorkDays.tsx and place it in both layouts outside Pin, using existing tokens. Render exact Hebrew label, zero and an explicit Hebrew unavailable state if summary fails. Reuse existing loading conventions; no fabricated or stale count displayed as current.
- [x] In DiaryProvider refresh the authoritative summary after successful creation, date/project correction and cancellation. Existing getSummary action is available for targeted reload; preserve filters, pagination and open form behavior. Do not derive deltas from loaded rows: cancelling a report may leave another report on the same date in an unloaded page. Handle stale responses after changing filters and refresh errors.
- [x] Add mutation tests covering a second report on the same day, a new date, date moves, cancellation of one versus the last report on a date, and refresh failure. Use fake fixtures/mocks and the existing server aggregate tests as evidence; no cloud data written.
- [x] Run affected diary suites and lint/types, then normal CI after dependency repair. Check Hebrew RTL at 360, 375, 390, 768, 1024, 1280, correct date-filter updates, zero/error states and no horizontal overflow. Record whether browser endpoints were mocked and what server authorization evidence exists; never call a mocked check a live server check.
- [ ] One reviewer; address findings, fetch/rebase, assess incoming changes, green checks, PR/merge and fast-forward main. Stop before merge if the model gate remains unresolved. No deployment without D31 approval.

## Verification record — 26 November 2026

### Implementation
- Isolated worktree `/private/tmp/ozma-project-work-days`, branch `codex/project-work-days`, initially based on refreshed `804f9f7`. PM checkout and shared PM docs preserved. Duplicate chat/worktree inventory checked before starting.
- Project-only `getSummary` runs concurrently with existing screen reads, with the exact fixed project and optional date bounds. The initial aggregate is independent of pagination. Summary authentication/visibility refusals return hidden/signed-out; unavailable summaries retain the diary with an explicit error.
- Shared `WorkDays` renders in both layouts after the toolbar, outside Pin, using existing tokens, Notice and Skeleton. Zero, loading and error are distinct. No counter or aggregate request in general diary, even with a project filter.
- Creation, correction/move and cancellation refresh the server aggregate. The pending count is hidden until refreshed. Screen identity and request versions discard stale responses; a mutation finishing after navigation uses the current screen's bounds. No list-derived count/delta, changed filters, full-page hydration or SQL.

### Tests and local checks
- Red: loader/UI suite had 7 expected failures before implementation (missing request/counter/visibility handling). Then all 31 diary tests passed.
- Red: browser save test expected 2 dates but received stale 1 before refresh implementation. A second red regression reproduced a cancellation finishing after a filter change, then passed after refreshing the current screen.
- `npm test -- --reporter=dot` under Node 24.22.3: 84 files / 1,135 passed, 5 skipped (2 files). This includes existing diary action/service/query tests. Initial sandbox run failed the existing local PDF Chrome launch; after successful build and outside-sandbox Chrome access the full suite passed. An intermediate run during an incomplete build failed the existing client-chunk inspection; final built-artifact run passed.
- `npm run lint`, `npm run typecheck`, `npm run build`: PASS under Node 24.22.3, with no env files copied/read. Dependencies were copied from the existing checkout for isolated local verification; no package/lockfile changes. Initial symlink-based Turbopack resolution and sandbox build attempts were environmental failures; actual local dependency copy and outside-sandbox build passed.
- `npm run test:foundation`: 1 passed; Linux-only Chromium smoke skipped on macOS.
- `npx playwright test --config tests/screens/diary/playwright.config.ts`: 14 passed using installed Chrome and a local Vite fixture. Real Provider, layouts, toolbar, list and cancellation dialog; mocked server actions, summary endpoint, navigation and save-form boundary. No hosted Next/Supabase or physical-device acceptance is claimed.
- Browser cases: second same-day report, new date, date/project moves, cancelling one vs last report while another is unloaded, pending/error/recovery, thrown transport failure, old filter result, out-of-order mutation results, exact refresh bounds, unchanged count across pagination, retained form, general diary exclusion, and cancellation finishing after a filter switch.
- At 360, 375, 390, 768, 1024, 1280: Hebrew RTL, count/zero/error, outside Pin and no document horizontal overflow all passed. These are browser DOM/layout assertions, not a human visual review. No screenshots were produced outside a reviewer.
- `git diff --check`: PASS. Only owned files changed.

### Authorization and remaining gates
- No live server denial test was run: no cloud test writes/accounts were authorized. Existing `getSummary` permission check, authenticated action wrapper and SQL/RLS contract were read; mocks and pre-existing cloud test source are source/unit evidence only, not current hosted verification. SQL, contracts and permissions are unchanged.
- Reviewer gate remains OPEN: A-39 requires one Sonnet reviewer, but available collaboration model identifiers include GPT models only. No reviewer was fabricated or silently substituted. The Sol approval in UPLOAD-LOCKFILE explicitly applies to that task only. All independent implementation and verification above are complete; merge must wait for a Sonnet reviewer or an explicit alternative-model decision.
- D31 production boundary remains CLOSED: existing main merges trigger Vercel production automatically (documented by the lockfile task). This task has no production/deployment approval, so do not merge even after review until that consequence is authorized. No deployment, migration, service/cost, env-value inspection or cloud data write occurred.
- Prepare a draft PR and run ordinary CI; keep the worktree/branch available for the eventual reviewer. Do not touch shared PM docs or message other chats.

### PR and integration state
- Draft PR [#162](https://github.com/alongefen/ozma-project-manager/pull/162); implementation `a7c4ea6b6a806d52d348926346217e9f156dcdaa`.
- Rebased onto `161beac` (UPLOAD-LOCKFILE #161). Incoming content is limited to the documented 22-line lockfile repair plus its task record; no feature overlap. `git range-diff 804f9f7..48e6381 origin/main..a7c4ea6` reports identical feature content. Local main was already fast-forwarded to `161beac` by its owner and matched origin/main when checked; this task did not switch the PM checkout.
- Ordinary CI [run 45808374660](https://github.com/alongefen/ozma-project-manager/actions/runs/45808374660) started on the implementation SHA. This follow-up only records the PR/integration evidence; the task remains a draft pending the reviewer and production gates above. No merge or production deployment was performed.
