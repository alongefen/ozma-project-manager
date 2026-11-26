# LEADS-FOUNDATION: leads data and UI foundation

## Approved intent
Alon, 26 November 2026 (A-49), requested a new leads page with data structure and UI. He will provide screenshots and collected fields in the build chat. Webhook intake and GREEN API messaging are future work. No external integration is authorized now.

## Live-system isolation — Alon, 26 November 2026
- The client already uses production. Use the existing Supabase project `izjmvyguzbampoasvnru`; do not create another database/project.
- Work on an isolated feature branch/worktree and validate on a Vercel Preview URL. Alon authorizes this feature's Preview workflow on the existing service; no new services/costs or production deployment. Confirm Preview configuration without printing secrets.
- `main` automatically deploys production (Alon-confirmed). **Stop before merge to main until Alon explicitly approves this feature's release.** Disable PR auto-merge; do not push directly to main, promote a Preview, assign a production alias or deploy production. This task-specific gate overrides A-26's automatic merge rule.
- Keep leads routes and navigation unavailable in production until activation is approved; enforce this on the server, including direct URLs and feature entry points. A Preview flag is not authorization: enforce the agreed user/RLS permissions as well. Do not alter the client's existing UI/flows.
- Preview shares the live DB: every write is real. Propose additive, isolated leads tables/RLS/functions with rollback; get concrete D31 migration approval before applying anything. Do not modify existing business data, auth users, policies or function behaviour as part of tests. If unavoidable shared changes are found, stop and present them explicitly.
- Use only uniquely identified fake lead rows for tests and clean up only those rows. Do not run existing broad cloud fixture/seed/reset suites against this live DB. Check for indirect effects on current lists/counts/audit behaviour before any approved write.
- Preview access, actual configuration and regression evidence must be verified by the task session; they are not verified by these instructions. Missing Preview credentials/configuration or additional cost requires a concrete request, without exposing secrets.

## Current state and ownership
Build chat launched: `01a217e2-212a-7a72-a84d-2b0339c37e9a` (local). No implementation started. Alon subsequently authorized required file edits on isolated branches and appointed this chat construction manager; no separate allocation approval is required. Parallel execution is coordinated below. Do not copy old demo lead requirements as approved scope.

## Next steps for the task session
1. Completed: received screenshots and extracted fields, actions and layout. Do not commit screenshots containing client data or real lead details.
2. Completed: clarified material gaps: access by role, global versus project scope, required/optional fields, lifecycle and allowed mutations. Record explicit decisions separately from proposals.
3. Completed: specification and file map closed. Execute the coordinated task plan below without a separate allocation gate. Read only relevant existing contracts/modules after scope is known.
4. Prepare reviewable migration/RLS/RPC/rollback proposals if needed. Obtain D31 approval for the concrete cloud change before applying it. No local Supabase, Docker, resets or re-running existing migrations.
5. Implement and verify data/permissions/logic first, then both UI shells using shared logic. Reads use RLS; writes use DB functions; server identity only.
6. Run one reviewer per A-39, fix findings, perform affected checks, follow A-48 for merge evidence and immediate merge reporting. Stop before merge until Alon explicitly approves release; main automatically deploys. Preview on the existing service is authorized within the isolation limits above.

## Acceptance to refine after screenshots
- Fields, actions and permissions match the agreed screenshot-based scope.
- Hebrew/RTL phone and desktop UI follows UI_CONVENTIONS; loading/empty/error states; no horizontal overflow at 360, 375, 390, 768, 1024, 1280.
- Allowed and forbidden server actions verified, including reads; affected tests and required CI pass. Coordinate a cloud-test window; do not assume the production-bound DB is safe for test writes or contains no real data.
- No webhook endpoint, external form/campaign intake, Make scenario, GREEN API client, credentials, outbound messaging or misleading active send button.

## Verification record
PM preparation: read AGENTS, NEXT_SESSION, template, relevant WORK_PLAN/DECISIONS sections; refreshed Git and inspected recent chats/worktrees. Documentation only; no code tests, DB actions or deployment checks. Design, implementation, review, cloud checks and user acceptance remain pending.


## Final functional specification — 26 November 2026

Status: functional specification and exact file allocation request finalized after Alon's field/permission answers and soft-delete/archive confirmation on 26 November 2026. No open product question blocks the agreed scope. Alon waived file-allocation approval: each isolated feature branch may edit files needed for the agreed scope. Coordination boundaries below prevent parallel conflicts; they are not a user approval gate. No implementation, SQL application or deployment has started. Alon's latest instruction overrides visual fidelity to these screenshots: they describe functionality and broad structure; UI_CONVENTIONS governs the actual design and create-button placement. Images and contact data are not copied into Git.

### Approved fields and behaviour — Alon, 26 November 2026

Global leads register, unrelated to projects. Only admins (the existing owner-level accounts) may access leads. Admins may create/edit all lead details, change status inline, archive and delete; non-admins receive no lead data or counters.

| Field | Requirement |
|---|---|
| Name | Required |
| Phone | Required, LTR; duplicates allowed only after warning and explicit create-anyway confirmation |
| Email | Optional, LTR |
| Company name | Optional text |
| Business type | Optional text |
| Project budget | Optional free text, including ranges |
| Has a designer | Yes / no / unknown |
| Has a plan set | Yes / no / unknown |
| Inquiry source | פייסבוק; אינסטגרם; google sheets; ידני |
| Marketing company | חברת השיווק החדשה; חברת השיווק הקודמת |
| Inquiry date | Required; defaults to today's Jerusalem date and is editable |
| Status | The eight labels below; editable directly from the table without opening details |
| Follow-up date | Optional date |
| Call summary / notes | One editable multiline value; no history required |

Approved statuses: חדש; בוצעה שיחה; רלוונטי להמשך; נשלחה הצעת מחיר; נסגרה עבודה; לא רלוונטי; מכחיש פנייה; אין מענה. No inferred automatic transitions or project creation.

List: lead name and company/business context, phone, inline status selection, follow-up date and overdue hint, source, and an open action. Search covers name, phone and company. Filters: marketing company, status/group, due today/overdue, and archive visibility. Due means follow-up date <= today's Jerusalem date, excluding נסגרה עבודה, לא רלוונטי and מכחיש פנייה. אין מענה remains eligible when due.

All three summary cards, status counts and percentages use the exact current filtered/searched population, including selected status, due and archive filters. Denominator is the filtered population; empty results yield zero percentages. Recompute immediately after inline status edits and other successful mutations.

Duplicate warning checks canonical phone formatting (spacing/dashes and equivalent Israeli local/+972 notation) on the server, without a unique phone constraint. A detected duplicate returns a warning before insertion, preserving entered values; a separate explicit override permits creation. Recheck at write time. Technical request idempotency still prevents duplicate inserts on retries. Implementation choice: warning includes archived leads but excludes soft-deleted leads; normalize without inventing unsupported number-format restrictions.

Implementation defaults (builder choices, distinguished from explicit Alon decisions): source defaults to ידני; status defaults to חדש; tri-state values default to unknown; optional marketing company is unselected until chosen. Newest inquiry date then stable ID order. Alon approved hiding archived leads by default, with an archive view and restore action. Soft-deleted leads are excluded from both active and archive views; their records remain in the database. No permanent-delete or deleted-items restore UI is included.

### Screen structure and shared UI

- One top-level `/leads` list with a shared provider/model and separate phone/desktop views. Desktop table; phone cards showing the same information and open action. No horizontal table scrolling on phone.
- Pinned primary action row: `Button icon="add"` labelled "ליד חדש", first/rightmost on desktop and full width on phone. Use `Pin`, `Page`, `DesktopTitle`, and the phone shell title. Preserve the existing centre report button and bottom navigation.
- Shared search, `SelectField` and due-only toggle; use `FilterPopup` when filters do not fit. Summary cards and status counts below the compact pinned area. Empty, filtered-empty, loading, error and forbidden states use existing shared components.
- Create and open/edit via shared `Sheet`, with phone bottom-sheet and desktop dialog treatment. Two-column fields on desktop, single column on phone; shared `DateField`, `SelectField`, `TextField`, `FormActions`, `Notice` and `Badge`. Do not reproduce native date/select controls from the screenshot.
- Proposed navigation entry: desktop sidebar and phone "עוד"; feature gate and approved permissions control both. The header/report button and existing routes retain their behaviour.
- Inline status selection is available in the desktop table and phone cards, using shared SelectField and optimistic state with rollback/error feedback. Archive/delete use ConfirmDialog; archive restore is included. No attachments, reminder delivery, message sending, project conversion or notes history are requested.

### Data approach and deletion semantics

Alon explicitly confirmed soft deletion, consistent with the rest of the system: remove the lead from ordinary UI and keep its database record. Admin-only archive, restore from archive and soft-delete actions use the shared confirmation pattern. Delete marks `deleted_at` and preserves business fields; archive is a separate state. No physical DELETE, permanent-delete RPC or hard-delete UI. Server reads, totals, duplicate detection and mutations consistently exclude soft-deleted records; deleted records cannot be edited or restored through the archive action.

Data approach: one dedicated additive leads table with approved business fields, `archived_at` and `deleted_at` markers, creator/server timestamps, idempotency request ID and optimistic revision. Fixed source/company/status options need no management tables. No notes-history table. Reads use actor JWT plus admin RLS; writes only dedicated admin-checked RPCs. Status, edit, archive/restore and delete must check current revision; warning override cannot bypass validation or permissions. Do not extend the shared Platform contract without an actual need; use a dedicated feature contract/factory.

A server-only gate defaults closed in production, including route access and every action entry point. Preview enablement is separate from actor/RLS authorization. The database itself remains the shared live database: a Preview flag does not make its writes temporary. Present exact migration, permission grants and rollback after scope is settled, before D31 approval/application. No changes to existing auth users or business rows for tests.

### Implementation file map

This is the implementation file map. Alon explicitly authorized all necessary feature files on isolated branches; no allocation approval is required. The list covers the approved fields, inline status, duplicate warning and archive/delete flows. Permanent deletion is excluded. The migration filename below has no collision in the current checkout.

New feature files:
- `src/types/contracts/leads.ts`
- `src/features/leads/logic/index.ts`
- `src/features/leads/logic/queries.ts`
- `src/features/leads/logic/commands.ts`
- `src/features/leads/logic/actions.ts`
- `src/features/leads/logic/validation.ts`
- `src/features/leads/logic/availability.ts`
- `src/features/leads/shared/model.ts`
- `src/features/leads/shared/load.ts`
- `src/features/leads/shared/LeadsProvider.tsx`
- `src/features/leads/shared/LeadForm.tsx`
- `src/features/leads/shared/LeadSheet.tsx`
- `src/features/leads/shared/LeadFilters.tsx`
- `src/features/leads/shared/LeadSummary.tsx`
- `src/features/leads/shared/LeadStatusField.tsx`
- `src/features/leads/shared/LeadActions.tsx`
- `src/features/leads/shared/DuplicateLeadDialog.tsx`
- `src/features/leads/shared/Leads.module.css`
- `src/features/leads/mobile/LeadsMobile.tsx`
- `src/features/leads/desktop/LeadsDesktop.tsx`
- `src/app/(app)/leads/page.tsx`
- `src/app/(app)/leads/loading.tsx`
- `src/app/(app)/leads/error.tsx`
- `supabase/migrations/20261126160000_leads_foundation.sql` (reserved proposal for allocation; recheck ordering/collision before creation; no existing migration edits)

Existing shared files needing serial allocation:
- `src/types/database.ts` (generated after approved migration)
- `src/lib/navigation.ts` (optional gated links/title and icon key)
- `src/components/ui/Icon.tsx` (leads icon)
- `src/app/(app)/layout.tsx` (server-derived gated desktop link)
- `src/app/(app)/more/page.tsx` (server-derived availability)
- `src/features/more/mobile/MoreMobile.tsx`
- `src/features/more/desktop/MoreDesktop.tsx`

New tests, isolated from broad live-data suites:
- `tests/logic/leads/queries.test.ts`
- `tests/logic/leads/commands.test.ts`
- `tests/logic/leads/actions.test.ts`
- `tests/logic/leads/leads.cloud.test.ts`
- `tests/screens/leads/model.test.ts`
- `tests/screens/leads/render.test.ts`
- `tests/screens/leads/availability.test.ts`
- `tests/screens/leads/duplicates.test.ts`
- `tests/screens/leads/status.test.ts`
- `tests/screens/leads/archive.test.ts`

Existing test files to extend if their contract changes:
- `tests/shell/navigation.test.ts`
- `tests/shell/nav-routes.test.ts`
- `tests/screens/shell/loading-structure.test.ts`

The feature manager maintains the shared coordination docs; task chats keep their own task notes. No package/lockfile, CI workflow, existing migration, auth implementation or global CSS edits proposed. Task execution boundaries are defined in the construction plan.

### Planned sequence and verification

1. Functional scope is closed. Alon appointed this chat feature construction manager and requested a separate chat per independent task. Start DATA and ISOLATION in parallel, then UI/Preview integration. No allocation or repeated product approval required.
2. Prepare additive schema/RLS/RPC and rollback proposal; obtain concrete D31 approval before cloud application. Confirm how forbidden-action testing can use existing approved identities without creating/changing users.
3. Implement contracts/data/logic and affected unit checks; isolated cloud writes only in an allocated window and only for uniquely identified fake lead rows, after required approval. Never run broad seed/reset/cloud suites.
4. Implement shared UI and both views. Verify six widths (360, 375, 390, 768, 1024, 1280), RTL, keyboard/sheet behaviour, no horizontal scroll and create-button placement. Verify production gate for direct URLs/actions/navigation and permitted/forbidden reads/writes separately.
5. One Sonnet reviewer under A-39. Sonnet is not exposed by the current agent tool's model options; report the limitation before review and obtain a supported review arrangement rather than silently substituting another model.
6. Record affected tests and regression evidence, run required CI, inspect Preview configuration without secrets and verify Preview on the existing service. No automatic merge; stop for Alon's explicit release approval.

### Verification in this build chat

Read the handoff, task section, A-49, UI_CONVENTIONS, architecture conventions/contracts and permission sections; inspected existing navigation, shell, more and feature factory patterns. Screenshots reviewed as functional references only. Refreshed origin/main and created managed worktree `/Users/alongefen/.codex/worktrees/leads-foundation/ozma-project-manager`, branch `codex/leads-foundation`, based on `4034e12`. Carried preparation/release/launch documentation commits into it as `abac430`, `a278e3f`, `563091d`. Management checkout untouched. No code checks, DB access, test writes or deployment verification performed; this is specification-only work. Alon's nine answers and final soft-delete/archive confirmation are recorded above. Functional scope and file list are closed; concrete D31 migration approval and all implementation verification remain pending. File-allocation approval was explicitly waived by Alon; parallel task boundaries are coordination only. Documentation diff reviewed; no code tests required for this documentation-only change (A-36).


## Construction management — Alon, 26 November 2026

Alon authorized required file edits on isolated feature branches, waived the allocation gate, appointed this chat feature construction manager, and explicitly requested separate chats for independent tasks. Two task chats at most. Current origin/main is `6f87ea1`; incoming changes since `4034e12` concern upload success feedback and its UI convention/tests, not leads contracts. No code checks are needed for this management-only change.

- LEADS-DATA: contracts, additive migration/rollback proposal, RLS/RPC and feature logic with local affected tests. No cloud execution without concrete D31 approval and coordinated test window.
- LEADS-ISOLATION: independent server feature-availability guard and local production/Preview authorization tests; read-only Preview readiness inspection if existing tools permit. No route, visible navigation or data dependency yet.
- LEADS-UI: queued until DATA contracts and ISOLATION guard are committed; then shared model, both shells, guarded navigation and local/browser checks.
- LEADS-INTEGRATION: queued after implementation; concrete D31 request, authorized bounded cloud verification, one integrated Preview/CI report, and STOP before main merge for release approval.

Reviewer model constraint remains explicit: current agent model options do not include Sonnet. Implementers may build and run affected local tests, but must report review as pending unless an actual Sonnet reviewer is available. Never silently substitute or claim review passed.
