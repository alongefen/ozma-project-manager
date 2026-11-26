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
