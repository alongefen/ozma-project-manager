# LEADS-UI: guarded actions and shared phone/desktop screens

## State and goal
DATA `a67ad3e` integrated as `8931860`; ISOLATION `48a58c7` integrated as `7b08b8c`. Build the agreed Hebrew RTL register on existing shared components, wiring every entry point to the availability guard before lead data access. No live DB operations or deployment in this dispatch. DATA independent review may yield SQL-only fixes; do not modify its contracts/SQL while implementing UI without coordination.

## Read only
AGENTS (includes authorized GPT-6.1 Sol fallback), LEADS-FOUNDATION final specification, LEADS-DATA Exact UI contract, LEADS-ISOLATION Integration contract, UI_CONVENTIONS. Existing users/overview/task forms and shared UI props only as needed. Do not copy old demo fields or native selects/dates.

## Files
- `src/features/leads/shared/**`, `mobile/**`, `desktop/**`; `src/app/(app)/leads/{page,loading,error}.tsx` (actual Next file names `page.tsx`, `loading.tsx`, `error.tsx`).
- Replace closed `src/features/leads/logic/actions.ts`; existing `tests/logic/leads/actions.test.ts` must be updated for the now-live guarded wrapper. Do not edit DATA factory/contract/SQL or ISOLATION modules.
- Shared integration only: `src/lib/navigation.ts`, `src/components/ui/Icon.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/more/page.tsx`, `src/features/more/{mobile/MoreMobile,desktop/MoreDesktop}.tsx`. Add default-off optional nav availability input; existing callers keep unchanged output. Add links only with server-derived guard and an actual implemented route; preserve phone report centre button.
- `tests/screens/leads/**`, affected shell navigation/loading tests, this task note. No global CSS/dependency/CI/env edits. Necessary additional feature files are authorized; coordinate conflicting files only, no allocation approval needed.

## Existing exact interfaces
- `createLeadsApi(platform)` from logic/index.ts. Standalone types/labels/schemas in `@/types/contracts/leads`; shared pure `filterLeads(rows, parsedFilters, today)` and `leadIsDue(row,today)` in logic/filters.ts. Do not reimplement their rules.
- `isLeadsAvailable(isAdmin:boolean)` from logic/availability.ts. Pass only `context.value.actor.isOwner` from successful server auth; failed context denies. Runtime only Preview + exact flag true + admin; production closed even with flag. No environment or role controls accepted from client.
- API methods: listLeads(ctx,filters)->Result<LeadRow[]>; getLead(ctx,{id})->Result<LeadRow>; createLead(ctx,CreateLeadInput)->Result<{kind:'saved',saved:{id,revision}}|{kind:'duplicate',duplicateCount}>; updateLead(ctx,{id,expectedRevision,fields})->Result<Saved>; setLeadStatus(ctx,{id,expectedRevision,status})->Result<Saved>; setLeadArchived(ctx,{id,expectedRevision,archived})->Result<Saved>; deleteLead(ctx,{id,expectedRevision})->Result<Saved>.
- Fields: name, phone, email, companyName, businessType, projectBudget (text), hasDesigner, hasPlanSet, source, marketingCompany, inquiryDate, status, followUpDate, notes. Only name/phone/inquiryDate required. Optional empty values -> null. Source default manual, status new, tri-state unknown, marketingCompany null. Date comes from server Jerusalem today. Use exported enum arrays and Hebrew labels; no extra status/source/group codes.
- Filters: search, marketingCompany?, statuses:LeadStatus[], dueOnly, archive:'active'|'archived'|'all'. List call `{archive:'all'}` loads the full nondeleted population using DATA pagination; client model applies filters for immediate search/counts. Do not initially fetch only active rows and then pretend archive filtering is complete.

## Build and verification steps
- [x] Guarded actions first: obtain server platform/context (existing per-request helpers where appropriate), fail closed, run availability before every lead query/RPC, validate input and call factory. Every one of seven exports is independently guarded, including list/get/duplicate flow. Preserve Result and Hebrew safe errors; no user context input and no cross-request cache.
- [x] Guard page before any lead read/count/loader. Use server-derived today, actor and availability; render forbidden/notFound without data when denied. Avoid hydration or shell nav leaks in production. Loading/error route chrome must not expose functional lead entry points in production.
- [x] Add failing targeted tests proving production+flag and non-admin/failed-context route/actions perform zero lead reads/RPCs; authorized Preview exercises correct factory call. Real guard policy tests are existing evidence; these are new integration tests, not a repeat.
- [x] Shared provider/model: compute filtered rows + all three summary cards + each status count/percentage from the same filtered population; zero denominator -> zero. First card is total matching leads, second due matching leads, third won matching leads. Filters include search/company/status/due/archive. Default newest inquiryDate then stable ID descending; archive hidden, archived view and restore.
- [x] Desktop table and phone cards with name/company context, LTR phone, inline SelectField status, follow-up/due hint, source and open action. Share forms/actions/state. Inline status optimistic update, rollback + safe error on failure; correct handling of revision conflicts, double clicks and in-flight reloads. All summaries react to successful/optimistic filter changes consistently.
- [x] Create/edit Sheet with all approved fields; TextField/SelectField/DateField/FormActions and responsive layout. No notes history. Creation preserves fields/requestId through duplicate warning and explicit create-anyway; successful completion/new attempt gets new ID. Use existing secure request-ID patterns. No displayed fake success or active integration/send button.
- [x] Archive/restore/soft-delete via ConfirmDialog and revision-protected actions; preserve database records, deleted rows never restored by archive. Only approved admin UI. Use shared Notice, Badge, StateMessage, skeletons and error mapping.
- [x] Title/header/Page/Pin follow UI_CONVENTIONS. New lead first/rightmost in pinned row and full width on phone. Desktop sidebar + phone More only; preserve bottom nav/report button and current production UI.
- [x] Tests for filters/counters/zero rows/due terminal exclusions; duplicate cancel/override/retry; optimistic failure/conflict; archive/restore/delete; title/nav/gate/loading. Run only affected local tests + TypeScript/lint needed for new components; reuse 50 DATA and 17 ISOLATION test evidence unless a changed dependency or finding warrants rerun.
- [x] One reviewer using Sonnet or authorized `gpt-6.1-sol` fallback. Reviewer checks all six widths 360/375/390/768/1024/1280 in Hebrew RTL with no horizontal overflow. Use local fake fixtures/mocks if live DB is unavailable; no test-only auth/flag bypass in shipped app. Record exact fixture limitations. No live cloud tests or production writes. Browser QA screenshots stay with reviewer.
- [x] Commit task files with checks/gaps and return SHA to feature manager. Do not push/deploy/open or merge a main PR from this child; feature manager integrates first. A verified Preview is later, not claimed from local fixtures.

## Hard limits
Existing shared live DB `izjmvyguzbampoasvnru`, no migration/SQL/cloud write in this dispatch. Do not change/create auth users or client data. No seeds/resets/broad cloud suites, local Supabase/Docker, secrets/env value reads or output, new dependency/service/cost, webhook/Make/GREEN API/messaging. No main merge, auto-merge, production deploy/promotion/alias. Only Alon can authorize the feature release. Sonnet unavailability is no blocker now: fallback GPT-6.1 Sol is expressly approved in AGENTS/main `189d65d`.

## Implementation record — 26 November 2026

Branch `codex/leads-ui`, created from the required snapshot
`fb357e17a502ae72b9f1d5c3880d3dfb614f2b66` in the dispatched isolated worktree.
No other checkout/branch changed. This dispatch does not push, open a PR, merge, deploy or
apply SQL. The DATA email fix remains separately owned and its contracts were not changed.

### Delivered implementation

- Replaced the closed wrapper first. All seven server exports authenticate independently,
  derive ownership from server context, check the real ISOLATION guard before constructing
  the leads API, validate strict input and call the existing factory. Failed context and
  production (even with the flag enabled) never reach a lead read/RPC/duplicate check.
- `/leads` checks the same guard before its loader/API. It loads `{ archive: 'all' }` and
  the server Jerusalem day, and rejects denied access with `notFound`. Loading contains
  data placeholders only; error uses the shared safe route error. No functional loading
  entry point is exposed before authorization.
- One shared provider/model supplies desktop table and phone cards. Existing `filterLeads`
  and `leadIsDue` define the population; all three summaries and every status percentage
  derive from that population. Search, marketing company, multiple statuses, due and archive
  filters are local. Stable ordering is newest inquiry day, then ID descending.
- Shared Sheet form includes every approved field using the existing fields/calendar/selects,
  null optional values, and server-day defaults. Duplicate cancel/override/retry preserves
  the fields and request ID; a new form gets a new secure ID. After an ambiguous failure,
  retries send the original values. No lead is optimistically created.
- Inline status is optimistic with rollback and safe errors; revision conflicts and ambiguous
  status results trigger authoritative reload. A synchronous write lock prevents duplicate
  clicks, and reload generations reject stale replies. Archive, restore and soft-delete are
  confirmed, revision-protected actions. The UI has no permanent delete or deleted restore.
- Navigation has an optional default-off availability input. Layout and both More views get
  the same server-derived availability. Phone bottom navigation/report button is unchanged.
  New-lead creation is first/rightmost in Pin and full width on phone.
- Additional affected shared convention test: `tests/screens/ui/one-language.test.ts` now
  lists `LeadFilters.tsx` among the existing FilterPopup consumers. Its exact shared-pattern
  assertions remain intact. No shared component implementation, global CSS, dependency,
  CI, migration, DATA helper/factory/contract or ISOLATION module was changed (apart from
  the expressly allocated navigation icon integration).

### Local verification

- New focused unit checks: **50 passing tests** across actions (29), route (6), model (7),
  feature navigation/loading (3), rendering (2) and actual layout/More guard integration (3).
  These prove zero lead calls for every blocked action and route, approved factory forwarding,
  full archive loading, server day, filter/counter/zero-denominator/due semantics, trimmed live search, stable
  ordering, optional-null handling, matching navigation gates and unchanged report placement.
- Existing affected navigation/route/loading checks: **27 passed** in three files.
- Existing UI convention/sticky-header scans: 29/30 initially passed. The only failure was
  the exact FilterPopup consumer list; after adding the new legitimate consumer, all 10
  tests in that affected file passed. The other 20 passing checks remain valid.
- TypeScript `tsc --noEmit --incremental false` and scoped ESLint were run. Initial fixture
  prop errors and one unused import were fixed; subsequent checks passed. Final reviewer
  follow-up and any subsequent affected-check results are recorded below.
- DATA's 50-test and ISOLATION's 17-test evidence is retained on unchanged modules; those
  suites were not repeated. No broad/cloud suite was run.

### Review and browser verification

One reviewer uses the explicitly authorized `gpt-6.1-sol` fallback because Sonnet is not
available in the exposed models. Local Vite harness in `tests/screens/leads/browser` runs the
real feature/components/shells with fake in-memory actions aliased only in its test config.
It includes the app's existing Tailwind preflight and actual app CSS. It creates no Next
route, auth/flag bypass, user or DB row. Browser screenshots remain with the reviewer in
`/tmp`, outside Git. Review completion/finding resolutions are recorded below.

### Remaining integration gates

No live Preview, SQL compilation/application, hosted RLS/RPC refusal, idempotency/concurrency,
real actor/session checks, production build, deployment or user acceptance is claimed.
Those require the feature manager's coordinated integration and concrete D31 approval.
Preview shares the client's live database. No DB/SQL, auth-user/client-data change, seed,
reset, secret/env-value read, new service/cost, push or main/release operation occurred.
The feature remains held before main/release until Alon's explicit approval.


### Final reviewer outcome and focused follow-up

- One GPT-6.1 Sol reviewer completed source review and reported no unresolved actionable
  leads findings. Two concrete modal findings were corrected and retested: duplicate-dialog
  close bubbled into the parent editor; programmatic editor close after archive opened an
  orphan discard confirmation. The feature now contains nested close events, ignores close
  callbacks without an editor and confirms editor Escape without losing the filled form.
- Reviewer browser evidence: Hebrew RTL list/form at **360, 375, 390, 768, 1024 and 1280**,
  no horizontal overflow, phone full-width create, settled screenshots and desktop table /
  two-column form. The final desktop open-button width was verified without midword wrapping.
  Screenshots were visually inspected by the reviewer and retained only in `/tmp`.
- Final interaction run exited 0: duplicate warning cancel preserves fields; explicit override;
  UNAVAILABLE retry retains one request ID and produces exactly one fake saved row; main
  Escape -> discard confirmation -> back preserves the editor; status CONFLICT/UNAVAILABLE
  rollback, visible delayed optimistic update and disabled in-flight control; multi-status
  filtering; archive -> archived filter -> restore -> active filter -> soft-delete confirmation.
  No browser runtime errors were reported. Test fake creation receipts were corrected to
  record actual successful fake inserts rather than infer success from attempted calls.
- Persisted command: `node tests/screens/leads/browser/check.mjs` (fixture server running).
  `LEADS_INTERACTIONS_ONLY=1` skips already-verified viewport/screenshot checks for targeted
  interaction follow-up. The executable defaults to installed Google Chrome; optional
  `LEADS_BROWSER_PATH` supplies another local executable. No browser dependency installed.
- Known existing shared-component limitation: Escape from the multiple-choice picker can
  dismiss the enclosing desktop FilterPopup before Apply. Multiple statuses can be applied
  by closing the picker through its control/outside area and then Apply. Shared picker/popup
  implementation was not changed; this limitation remains for a serial shared-UI follow-up.
- A separate red/green model regression confirmed that live search must be parsed before
  `filterLeads`; its fix uses the existing `LeadFiltersSchema`, without changing DATA rules.
  The seven model tests passed afterwards. Final changed-provider rendering checks (2),
  TypeScript and scoped ESLint including all fixture/check files passed after the last fixes.
- Aggregate affected local unit evidence: **107 passing tests** (50 new/updated feature checks
  plus 57 existing navigation/loading/UI-convention checks), without repeating unaffected
  DATA/ISOLATION suites. Browser checks are separate fake-data evidence, not hosted acceptance.
- Next owner: LEADS-FOUNDATION feature manager integrates this local commit into the isolated
  feature branch, coordinates the separate DATA fix, and arranges D31/hosted/Preview work.
  No push/PR/main merge/release is authorized by this handoff.
