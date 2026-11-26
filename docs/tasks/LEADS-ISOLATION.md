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
- [x] Add failing truth-table tests for production+flag, preview without flag, preview+flag+admin, non-admin, missing/unknown environment and client-controlled input independence. Implement policy and server-only wrapper; run affected tests.
- [x] Document exact integration usage: route and each action must check guard before data access; nav availability comes from the same server policy. RLS/RPC remains independently admin-only; no claim the feature flag provides DB permissions.
- [x] If connected service access permits, inspect existing Vercel Preview settings read-only using existing project identifiers/tools. Record readiness/missing setup without fetching or displaying env values or secrets. Do not change configuration, deploy, link new projects, incur cost or exercise writes through Preview. Readiness is not deployed verification.
- [x] Commit only task files; report SHA, guard usage, local checks, Preview readiness and review/model limitations. UI integration and actual guarded route/action tests are queued, not claimed complete by this unit.

## Safety and execution
- Read AGENTS and only relevant sections from the finalized spec in `docs/tasks/LEADS-FOUNDATION.md`; the user's latest instructions waive allocation approval and appoint that chat feature manager. Task file boundaries below prevent conflicting parallel edits, not a new approval requirement.
- Implement yourself. One reviewer per A-39; if Sonnet is unavailable, explicitly report review pending and do not substitute silently. Do not spawn an extra builder for this task.
- Existing live DB `izjmvyguzbampoasvnru`; no local Supabase/Docker, new service, secret output, auth-user changes, seed/reset or broad cloud tests. Preview shares live data. No DB writes or migration application in this dispatch. Fake rows only in a separately authorized future window.
- No integrations, messages, webhook, Make or GREEN API. Never merge to main, enable auto-merge, promote/deploy production or assign a production alias. Main auto-deploys; Alon's feature-release approval is still required.
- Preserve secrets, local work and valid test evidence. Use quiet affected checks with pipeline failure propagation (`set -o pipefail`, then `| tail -40`); no whole-project/cloud suites without impact-based reason. Commit named paths only. Record checks/gaps in your task note; report branch/SHA and follow-up in Hebrew.
- This task's worktree starts from current main. Read this brief and finalized spec from local branch `codex/leads-foundation` using git show BEFORE code. Bootstrap your task branch from the finalized manager snapshot as described by its opening prompt; never edit the manager checkout. Own code commit must exclude unrelated preparation docs; report its SHA for selective cherry-pick into the integration branch. No push/PR to main needed at this stage.

## Implementation and verification — 26 November 2026

Branch: `codex/leads-isolation`, created from the required manager snapshot `000e30e18ef025efe75957e24af3916e14ad0882` in the dispatched isolated worktree. No manager files or branch changed. Commit scope is the two availability modules, the local test file and this task note only. Sonnet is absent from the exposed agent model list: A-39 reviewer **pending**; no substitute reviewer was run.

### Integration contract for UI / DATA

- Import `isLeadsAvailable` directly from `@/features/leads/logic/availability` on the server. Its signature is `(isAdmin: boolean): boolean`; the pure policy signature is exactly the one allocated above. The wrapper reads only `process.env.VERCEL_ENV` and `process.env.LEADS_PREVIEW_ENABLED` on every call, with no actor or environment cache.
- Obtain the active server context first (existing `getContext()` / action authentication convention). Failed or unavailable context must deny access. Only a successful context's `actor.isOwner` supplies `isAdmin`; never accept it from form data, action arguments, cookies, query strings or headers.
- In the `/leads` route, deny with `notFound()` or the agreed forbidden response unless `isLeadsAvailable(context.value.actor.isOwner)` is true, **before** starting any lead query, count, prefetch, loader or data-dependent render. Every server action must independently authenticate and run this check before any lead read/RPC, including duplicate checks; a protected page does not protect a directly invoked action. Any additional server entry point must follow the same rule.
- Derive desktop and phone navigation availability on the server with this same function and active context; pass only the derived boolean to client components. Keep lead links absent until the route is built. No navigation, route, action, contract or DATA module was edited here.
- The flag provides feature availability only. Actor JWT reads still require admin RLS; writes still require dedicated admin-checked RPCs. This helper alone does not enforce database permissions or prevent an unguarded future entry point.

### Local checks

- Tests were added before implementation. Initial run failed because the availability modules did not yet exist; after implementation all **17 tests passed** in `tests/screens/leads/availability.test.ts`.
- Coverage: explicit Preview/admin enablement; production denial even with flag; non-admin denial; development/missing/empty/unknown/case-mismatched environments; missing/false/non-exact flags; server wrapper reads current settings and actor on every call; `NODE_ENV` and public environment flags cannot enable access.
- Command: `set -o pipefail; ./node_modules/.bin/vitest run --configLoader runner --project unit tests/screens/leads/availability.test.ts --reporter=dot 2>&1 | tail -40`.
- A local ignored `node_modules` symlink reuses installed dependencies without changing package/lockfiles. Vite's default bundled config loader attempted to write a cache through that shared dependency path and was refused by the sandbox; `--configLoader runner` avoided that write. No dependency installation or shared config change.
- Targeted ESLint passed with zero warnings for the three TypeScript files. No whole-project, cloud, browser, build or database test suite was run. Actual route/action rejection, active-admin context integration and navigation visibility checks remain queued for UI/integration; this unit adds no screen/layout.

### Preview readiness: partial, read-only evidence

- Vercel `list_projects` and `get_project` confirmed existing project `ozma-project-manager`, ID `prj_fRfIEjLXZ2sQC4cNkQIXJTtanfAZ`, team `team_yARk9OJYAQMM7N6zqWV2dLQL`. The latest production deployment reported READY; this is metadata only, not production flow verification.
- `list_deployments` filtered to Preview returned five READY branch deployments (`target: null`), including `codex/upload-success-toast` at `ea89cfa5bb416851bf4d6af6fa727fbf73ba568a`. Existing Preview infrastructure therefore has deployment evidence, but none verifies this leads branch.
- Project metadata reports SSO protection enabled for `all_except_custom_domains`. Protected Preview access has not been exercised. The project reports Node `26.x`, whereas package engines request `>=24 <25`; no configuration was changed. Integration should resolve/verify the actual feature build runtime if this discrepancy affects its build.
- The available environment-list endpoint can return values and has no metadata-only projection, so it was deliberately not called. The existence/value/scope of `LEADS_PREVIEW_ENABLED`, the runtime `VERCEL_ENV`, and Preview backend configuration remain **unverified**. No env values, secrets, logs or deployment content were fetched or printed. A later authorized configuration step must ensure server-only Preview enablement, followed by actual guarded Preview checks.
- No deployment, env/config edit, service creation, cost, DB access/write, auth change, seed/reset, push, PR or main merge. Feature release remains blocked until Alon's explicit approval.
