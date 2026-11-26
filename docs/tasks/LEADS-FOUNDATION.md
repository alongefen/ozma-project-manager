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
Brief ready; build chat not launched. No implementation started. This task owns this task file only until screenshot-based scope and exact code/shared-file ownership are allocated by the PM in WORK_PLAN. No SQL or navigation ownership yet. Do not copy old demo lead requirements as approved scope.

## Next steps for the task session
1. Receive screenshots; extract visible fields, actions and layout. Do not commit screenshots containing client data or real lead details.
2. Clarify only material gaps: access by role, global versus project scope, required/optional fields, lifecycle and allowed mutations. Record explicit decisions separately from proposals.
3. Present a concrete design and implementation plan; return exact file list for PM ownership allocation before code. Read only relevant existing contracts/modules after scope is known.
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
