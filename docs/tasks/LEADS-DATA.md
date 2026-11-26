# LEADS-DATA: contracts, data proposal and logic

## Goal and dependencies
Ready to start from the finalized LEADS-FOUNDATION spec. Independent of ISOLATION. Deliver testable local logic and a concrete additive SQL/rollback proposal; do not apply it to the live DB.

## Read
AGENTS; LEADS-FOUNDATION final specification; ARCHITECTURE 3.2 and 5.1-5.3; PERMISSIONS 1-4; existing tasks/users contracts, feature factories, `src/lib/db/rpc.ts`, `fetchAll` and current owner/session helpers. Read applicable Supabase skills before SQL work. Do not read whole long docs.

## Files and interface
- `src/types/contracts/leads.ts`: standalone Zod schemas/types, enums and Hebrew labels; `LeadRow`, create/edit/filter inputs and `LeadsApi`. Follow existing Result/RequestContext/Saved conventions. Do not extend global Platform unless necessary; report actual shared requirement first.
- `src/features/leads/logic/{index,queries,commands,actions,validation}.ts`; phone normalization helper under this logic directory if justified. ISOLATION owns `availability.ts`; do not touch it. Initially expose no UI route. The UI integrator must wire the availability guard into every action before Preview.
- New additive leads migration, one SQL rollback file outside migrations, and this task note. Do not edit old migrations or existing business policies/functions. No generated database type update pretending cloud application occurred; explain the typed query strategy until approved generation is possible.
- `tests/logic/leads/**` and narrow schema/SQL checks needed by this task. New cloud tests may be prepared but must not run.
- Produce exported exact signatures and field/status/source/company codes in this task note for later UI consumption. Fixed enum/check values need no management tables or notes-history table.

## Steps and tests
- [ ] Define schemas and API; add failing tests for required fields, optional free-text budget, enums, invalid dates/empty strings, admin refusal and no project link. Implement and run affected tests.
- [ ] Prepare dedicated table, SELECT RLS and write RPCs using existing active-owner checks. Include revision conflicts, request-id idempotency, server timestamps, archive/restore and soft deletion. Specify no physical deletes and no notes history. Unit/static SQL review is not hosted permission evidence.
- [ ] Implement RLS reads with full pagination, safe errors, owner checks; direct table writes forbidden. Writes only RPCs. Exclude deleted records consistently.
- [ ] Implement canonical-phone duplicate warning, including archived leads and excluding deleted leads, rechecked at insertion. Explicit override permits duplicates; request retries remain idempotent. Test Israeli formatting equivalence, warning without insertion, explicit override, stale edits and retry behaviour.
- [ ] Prepare a D31 request specifying exact objects/grants, effects on current system, service/cost implications (no new service), rollback and data-preservation implications. Do not run/apply SQL or claim costs verified without evidence.
- [ ] Run affected local tests, review as available under the model constraint, commit only your files and report SHA, interface, checks and pending D31/hosted verification.

## Safety and execution
- Read AGENTS and only relevant sections from the finalized spec in `docs/tasks/LEADS-FOUNDATION.md`; the user's latest instructions waive allocation approval and appoint that chat feature manager. Task file boundaries below prevent conflicting parallel edits, not a new approval requirement.
- Implement yourself. One reviewer per A-39; if Sonnet is unavailable, explicitly report review pending and do not substitute silently. Do not spawn an extra builder for this task.
- Existing live DB `izjmvyguzbampoasvnru`; no local Supabase/Docker, new service, secret output, auth-user changes, seed/reset or broad cloud tests. Preview shares live data. No DB writes or migration application in this dispatch. Fake rows only in a separately authorized future window.
- No integrations, messages, webhook, Make or GREEN API. Never merge to main, enable auto-merge, promote/deploy production or assign a production alias. Main auto-deploys; Alon's feature-release approval is still required.
- Preserve secrets, local work and valid test evidence. Use quiet affected checks with pipeline failure propagation (`set -o pipefail`, then `| tail -40`); no whole-project/cloud suites without impact-based reason. Commit named paths only. Record checks/gaps in your task note; report branch/SHA and follow-up in Hebrew.
- This task's worktree starts from current main. Read this brief and finalized spec from local branch `codex/leads-foundation` using git show BEFORE code. Bootstrap your task branch from the finalized manager snapshot as described by its opening prompt; never edit the manager checkout. Own code commit must exclude unrelated preparation docs; report its SHA for selective cherry-pick into the integration branch. No push/PR to main needed at this stage.

## DATA delivery — 26 November 2026

Implementation prepared on `codex/leads-data`, based on manager snapshot `000e30e18ef025efe75957e24af3916e14ad0882` (main baseline `6f87ea1`). Only DATA files are included. No UI, global Platform extension, generated database type update, availability files, existing business policies/functions, auth data, dependencies or CI changes.

### Exact UI contract

Import from `@/types/contracts/leads` (standalone; no barrel change). All operations return the existing `Result<T>`. Factory: `createLeadsApi(platform: Pick<Platform, 'rpc' | 'fetchAll' | 'permissions'>): LeadsApi`. Context is the existing server `RequestContext`; never accept it from a browser.

| Method | Input (second argument after context) | Success value |
|---|---|---|
| `listLeads` | `LeadFiltersInput` | `LeadRow[]`, the complete filtered population |
| `getLead` | `{ id: string }` | `LeadRow` (active or archived; never deleted) |
| `createLead` | `CreateLeadInput` | `{ kind: 'saved', saved: Saved }` or `{ kind: 'duplicate', duplicateCount: number }` |
| `updateLead` | `UpdateLeadInput = { id, expectedRevision, fields: LeadFields input }` | `Saved` |
| `setLeadStatus` | `{ id, expectedRevision, status: LeadStatus }` | `Saved` |
| `setLeadArchived` | `{ id, expectedRevision, archived: boolean }` | `Saved` |
| `deleteLead` | `{ id, expectedRevision }` | `Saved` |

`Saved = { id: string, revision: number }`. `LeadFields` keys: `name`, `phone`, `email`, `companyName`, `businessType`, `projectBudget`, `hasDesigner`, `hasPlanSet`, `source`, `marketingCompany`, `inquiryDate`, `status`, `followUpDate`, `notes`. All optional text/date/company values become `null`; convert empty optional form values to null before submission. Required: nonblank `name`, nonblank `phone`, valid `inquiryDate` (`YYYY-MM-DD`). UI defaults inquiry date from the server Jerusalem day. Budget is free text. Limits: name/company/business 200, phone 80, email 254, budget 500, notes 10000 characters. Unknown keys, client identity/timestamps and project links are rejected. Update replaces the entire field object, preserving unrelated metadata.

`LeadRow` adds `id`, `revision`, `canonicalPhone`, `archivedAt`, `createdAt`, `updatedAt`, `createdBy`. No deleted marker is exposed. `CreateLeadInput` adds required `requestId` and optional `allowDuplicate` (default false). Preserve the form and request ID across warning/override and network retries; explicit confirmation sends `allowDuplicate: true`. SQL rechecks canonical phone at insertion. Duplicate warning includes archived records and excludes deleted records. Retrying a saved creation returns its existing ID/current revision, even after phone changes; a retry after deletion returns NOT_FOUND, never reinserts. Ordinary edits may change phone without the create-anyway dialog; warning is a creation flow as specified. Revision-protected edits, status/archive/delete use dedicated RPCs and cannot touch deleted rows. No delete restore or physical delete exists.

Exact codes, with Hebrew label maps exported alongside schemas:
- `LeadStatus`: `new` (חדש), `called` (בוצעה שיחה), `qualified` (רלוונטי להמשך), `proposal_sent` (נשלחה הצעת מחיר), `won` (נסגרה עבודה), `irrelevant` (לא רלוונטי), `denies_inquiry` (מכחיש פנייה), `no_answer` (אין מענה).
- `LeadSource`: `facebook`, `instagram`, `google_sheets`, `manual` (default).
- `LeadMarketingCompany`: `new_company`, `previous_company`; default `null`.
- `LeadTriState`: `yes`, `no`, `unknown` (default).
- Filters: `{ search?: string, marketingCompany?: LeadMarketingCompany, statuses?: LeadStatus[], dueOnly?: boolean, archive?: 'active' | 'archived' | 'all' }`; defaults empty search/statuses, false dueOnly and active archive. Empty statuses means all statuses. For a group, pass its exact status array; no extra group enum was invented.

`logic/filters.ts` and `logic/phone.ts` are pure and can be imported by the shared model. `filterLeads(rows, parsedFilters, today)` and `leadIsDue(row, today)` share server/UI rules. Due means follow-up <= server Jerusalem today, excluding won/irrelevant/denies_inquiry; no_answer remains eligible. Search is literal name/phone/company text plus canonical phone, with no PostgREST filter interpolation. List reads use actor JWT/RLS and `fetchAll`, ordered inquiry date descending then ID descending; no 1000-row truncation. Cards, status counts and percentages must derive from the returned filtered population, and recompute/reload after every successful mutation; denominator zero yields zero. Summary card definitions remain with UI/spec; DATA invents no extra business metric.

`actions.ts` exports all seven method names with context-free inputs, but deliberately returns NOT_FOUND for every call during this dispatch. **Integration must replace the closed wrapper with the committed ISOLATION guard, server-created Platform/context, then the factory call before any Preview UI exposure.** No route exists here. Server-component list reads also require that availability guard. Permission checks are separate: every factory operation calls the live `permissions.requireOwner` before parsing/data access; every proposed write RPC independently calls `private.require_owner` (including active session checks). Production availability cannot be inferred from an owner role.

Typed reads use a feature-local `SupabaseClient<LeadsDatabase>` projection of the proposed table, runtime-validated with `LeadRowSchema`; the actor JWT client is retained. No service client or direct writes. RPCs use existing `platform.rpc`, with runtime output validation. Replace the temporary local DB projection only after approved migration application and actual generated types. Existing safe Hebrew error mapping is reused; VALIDATION, CONFLICT, NOT_FOUND, FORBIDDEN, UNAUTHENTICATED and UNAVAILABLE remain standard errors. Duplicate is a success union branch, not a new global error code.

### Concrete D31 request — pending; do not apply

Proposed migration: `supabase/migrations/20261126160000_leads_foundation.sql`. This timestamp was reserved by the manager and rechecked against the current migration directory; no collision. The task's explicit proposal-only/no-local-DB instructions take precedence over the Supabase skill's live iteration/pull workflow. No SQL was executed or schema introspected against the live project.

Target: existing shared live project `izjmvyguzbampoasvnru`, Ireland. Purpose: store the approved global admin-only lead register. Exact additive objects:
- One `public.leads` table with explicit business columns; UUID ID, creator FK to profiles (`ON DELETE RESTRICT`), server timestamps, optimistic revision, archive/delete timestamps and unique `(created_by, request_id)`. No project FK, notes history, management table, trigger, webhook, storage bucket or new extension.
- One SELECT policy `leads_owner_select`: authenticated active owner via `(select private.owner())`, only `deleted_at is null`. RLS enabled. Revoke all table privileges from PUBLIC/anon/authenticated/service_role; grant only SELECT to authenticated. No direct table writes or service-role access.
- Partial indexes `leads_phone_live` and `leads_order_live`; PK/creator-request uniqueness indexes are created by constraints. Canonical phone is intentionally not unique.
- Private helpers `lead_phone(text)`, `lead_keys(jsonb,text[],text[])`, `lead_fields(jsonb)`, `mutate_lead(text,jsonb)`; EXECUTE revoked from PUBLIC/anon/authenticated/service_role. No existing helper definition is changed.
- Five fixed-path SECURITY DEFINER JSONB RPCs `create_lead`, `update_lead`, `set_lead_status`, `set_lead_archived`, `delete_lead`. Each takes `input jsonb`, matching contract camelCase fields. Revoke EXECUTE from PUBLIC/anon/authenticated/service_role, grant only authenticated; active-owner guard still applies inside. The four mutation endpoints delegate to the private implementation. Owner guard runs before input validation/data access. No system RPC.

Effects: no modification of existing business/auth rows, policies or function behavior; no changes to existing sensitive-events counters/audit constraints (leads do not add events to that table). Existing profile FK means an eventual future physical profile deletion would be refused while leads reference it; current profile management is deactivation, not deletion. Creates and all lead mutations serialize on dedicated advisory key `(190049,1)` so duplicate checking and phone edits cannot race. That key was checked against current migration files; no reuse found. No lead operation locks existing project tables; existing active-owner helper briefly shares the actor profile lock as it already does for writes. Lists read all visible lead pages; scale/performance and concurrent live DB behavior remain unverified.

Cost/services: no new service, plan, extension, paid AI or external call. Uses existing Supabase DB storage/compute; no additional fixed service cost is proposed. Actual quota/headroom/usage costs were not checked and no cost guarantee is claimed. No production merge, deployment or activation is requested here.

Rollback proposal: `supabase/rollback/20261126160000_leads_foundation.down.sql`, outside migrations. First disable availability/routes/actions; then revoke all leads table and five public RPC privileges. Leaves every lead row, retry key, table, policy, index and helper in place; no business/auth changes and no physical deletes. This containment rollback intentionally does not reverse migration history or destroy retained data. Re-enabling requires approved restoration of SELECT/five EXECUTE grants, not rerunning the migration. Physical object removal would need a separate data-preservation decision/D31 approval. Rollback itself must be scheduled and approved; it has not run.

Requested future approval: apply exactly this additive migration, then generate types and conduct one separately coordinated bounded hosted verification window using only approved existing identities and uniquely identified fake leads. No auth-user creation/changes, broad fixtures/seed/reset, existing-business test writes or unapproved physical cleanup. Fake lead rows can be soft-deleted through the approved API; physical cleanup is not supplied/authorized. Before execution, agree whether retaining these soft-deleted fake rows is acceptable or obtain narrowly scoped physical cleanup authorization. Server verification must cover owner/non-owner/disabled/revoked/anon/service-role reads and writes, unknown fields/actor spoofing, direct table write refusal, stale revisions, duplicate warning/no insert, override, two concurrent same-phone creates, same-request concurrent retries, phone edits, archive/restore/delete, deleted invisibility/retry and existing-system list/count/audit regression. No such hosted evidence exists yet.

### Verification and remaining gates

- Local affected Vitest: 50 tests passed in five files (contracts, commands, queries, fail-closed actions, SQL structure). Includes Israeli formatting equivalence, free-text budget/defaults, required/invalid/unknown/project fields, owner refusal before reads/writes, 1001-row pagination, late-page failure, archive/status/company/due/search combinations, excluded terminal statuses and no-answer eligibility, matching RPC routing and propagation of server stale-revision errors. Mock RPC tests verify retry/override forwarding and duplicate result handling, **not actual SQL idempotency/concurrency**. Static SQL tests verify grants/owner predicate/deleted guards/locking/retry ordering/enums/rollback shape, **not SQL compilation or runtime semantics**.
- TypeScript `tsc --noEmit --incremental false`: passed after correcting generic schema input/output defaults and test-row nullability.
- Scoped ESLint with `--max-warnings=0`: passed after consuming the deliberately ignored action input. No package/config changes.
- No cloud SQL, migration application, DB write, auth-user change, seed/reset, Preview request, production deployment, main merge, broad/cloud suite or secret/env-value read performed. Migration body and permission/rollback changes remain proposals. No screen/layout work, so viewport checks do not apply to this DATA dispatch.
- A-39 reviewer: **pending**. Sonnet is unavailable in this harness's listed model options; no alternate reviewer was silently substituted and no independent review is claimed.
- Next owner: LEADS feature manager integrates the DATA commit alongside ISOLATION, arranges actual Sonnet review, obtains concrete D31/window approval, then queues UI/Preview verification. Main release remains held for explicit Alon approval.


## Feature-manager integration and review — 26 November 2026

- Source `a67ad3e60b5104b2bcc19cd501cb292284dd580a` integrated as `8931860`; original 50-test/TypeScript/lint evidence preserved on unchanged files.
- One reviewer on the explicitly authorized GPT-6.1 Sol fallback found P2 SQL/Zod email parity: direct RPC can save `a@b.c` or `a..b@example.com`, rejected by LeadRowSchema and therefore breaking list mapping. D31 application is held until corrected; narrow fix task `LEADS-DATA-FIX` owns migration email validation and its regression checks. UI may proceed against unchanged contracts.
- No other actionable finding in the reviewed scope; hosted SQL compilation, permissions and concurrency remain unverified. Original reviewer will inspect only the concrete changed fix, not rerun the full review.
