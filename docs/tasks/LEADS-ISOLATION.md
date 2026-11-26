# LEADS-ISOLATION: server availability guard and Preview readiness

## Goal and dependencies
Ready independently of DATA. Build the server guard that keeps leads unavailable on production even at direct URLs/actions. Do not build data, screens or navigation links in this task.

## Read
AGENTS; LEADS-FOUNDATION safety/final specification; existing configuration/server-only conventions, `src/components/shell/request.ts`, shell/navigation usage and testing conventions. Read applicable Vercel skill before inspecting existing Preview setup. No whole-doc reads.

## Files and exact integration contract
- `src/features/leads/logic/availability.ts`: server-only wrapper exporting `isLeadsAvailable(isAdmin: boolean): boolean`, plus a throwing/notFound wrapper only if justified. Server derives isAdmin from active request context, never from client input.
- `src/features/leads/logic/availability-policy.ts`: pure policy exporting `leadsAvailability({ environment, enabled, isAdmin }: { environment: string | undefined; enabled: string | undefined; isAdmin: boolean }): boolean`.
- `tests/screens/leads/availability.test.ts`; this task note only. No edits to DATA files, global config, navigation, routes, shared docs or env files. Any necessary additional file can be coordinated with the feature manager without asking Alon for an allocation approval.
- Environment source: server reads `VERCEL_ENV` and a dedicated non-public `LEADS_PREVIEW_ENABLED`. Allow only `VERCEL_ENV === 'preview'`, explicit flag `'true'`, and active admin. Production always false even when flag=true; missing/unknown/development values default false. Never use NODE_ENV as a Preview signal. No public flag, cookies, URL/header overrides or cross-request actor cache.

## Steps and tests
- [ ] Add failing truth-table tests for production+flag, preview without flag, preview+flag+admin, non-admin, missing/unknown environment and client-controlled input independence. Implement policy and server-only wrapper; run affected tests.
- [ ] Document exact integration usage: route and each action must check guard before data access; nav availability comes from the same server policy. RLS/RPC remains independently admin-only; no claim the feature flag provides DB permissions.
- [ ] If connected service access permits, inspect existing Vercel Preview settings read-only using existing project identifiers/tools. Record readiness/missing setup without fetching or displaying env values or secrets. Do not change configuration, deploy, link new projects, incur cost or exercise writes through Preview. Readiness is not deployed verification.
- [ ] Commit only task files; report SHA, guard usage, local checks, Preview readiness and review/model limitations. UI integration and actual guarded route/action tests are queued, not claimed complete by this unit.

## Safety and execution
- Read AGENTS and only relevant sections from the finalized spec in `docs/tasks/LEADS-FOUNDATION.md`; the user's latest instructions waive allocation approval and appoint that chat feature manager. Task file boundaries below prevent conflicting parallel edits, not a new approval requirement.
- Implement yourself. One reviewer per A-39; if Sonnet is unavailable, explicitly report review pending and do not substitute silently. Do not spawn an extra builder for this task.
- Existing live DB `izjmvyguzbampoasvnru`; no local Supabase/Docker, new service, secret output, auth-user changes, seed/reset or broad cloud tests. Preview shares live data. No DB writes or migration application in this dispatch. Fake rows only in a separately authorized future window.
- No integrations, messages, webhook, Make or GREEN API. Never merge to main, enable auto-merge, promote/deploy production or assign a production alias. Main auto-deploys; Alon's feature-release approval is still required.
- Preserve secrets, local work and valid test evidence. Use quiet affected checks with pipeline failure propagation (`set -o pipefail`, then `| tail -40`); no whole-project/cloud suites without impact-based reason. Commit named paths only. Record checks/gaps in your task note; report branch/SHA and follow-up in Hebrew.
- This task's worktree starts from current main. Read this brief and finalized spec from local branch `codex/leads-foundation` using git show BEFORE code. Bootstrap your task branch from the finalized manager snapshot as described by its opening prompt; never edit the manager checkout. Own code commit must exclude unrelated preparation docs; report its SHA for selective cherry-pick into the integration branch. No push/PR to main needed at this stage.
