# Leads foundation construction plan

**Goal:** deliver the approved global admin-only leads register on both existing shells, verified in Preview and held before production release.
**Spec:** `docs/tasks/LEADS-FOUNDATION.md` final functional specification.
**Architecture:** dedicated additive data/permissions/RPC layer; shared feature API and screen model; separate phone and desktop views. Server Preview guard is independent of DB permissions.
**Stack:** existing Next.js, Supabase Cloud, Vercel; no new dependencies/services.

## Global constraints
Use existing live DB; no cloud mutations without concrete D31 and test-window authorization. Preview only, no main merge/release without Alon. Required file edits authorized on isolated branches; no allocation gate. Two task chats maximum. Existing product data/auth users and production UI must remain unaffected. Preserve A-48 evidence. Sonnet review limitation must be explicit.

## Review focus
1. Production environment with flag enabled must still refuse route/action/navigation before reads (ISOLATION unit policy, then UI integration tests).
2. Archived versus deleted duplicate phones, canonical Israeli formatting and concurrent creates must honour warning/override and retry idempotency (DATA).
3. Every counter/percentage follows the same current filter/search set, including zero rows and changed status (UI model).
4. Non-admin, disabled/session-invalid admin, stale revision and direct RPC/table write attempts must fail on server (DATA; hosted verification only after authorization).
5. Archive/restore cannot revive deleted rows; counts and filters remain consistent after failed optimistic writes (DATA and UI).

## Work packages
- [ ] DATA — `docs/tasks/LEADS-DATA.md`: contracts + migration/rollback proposal + RLS/RPC + local logic/tests. Produces exact API exports and D31-ready request. No cloud application.
- [ ] ISOLATION — `docs/tasks/LEADS-ISOLATION.md`: independent server Preview/admin gate + policy tests + read-only readiness. Produces `isLeadsAvailable(isAdmin)` and pure policy.
- [ ] UI — starts after DATA/ISOLATION commits are integrated into this feature branch. Use DATA exported types/APIs and ISOLATION guard; build list/model/filters/counters, create/edit/duplicate dialog, inline status, archive/delete, mobile/desktop, guarded nav, skeletons/error state. Test filtered denominator, due exclusions, zero rows, mutation failures; verify all six widths and production route/actions/nav denial. Prepare a separate exact task brief using actual exported interfaces, not invented signatures.
- [ ] INTEGRATION — after local review/checks, present DATA's concrete D31 migration/rollback for Alon; no dependent cloud operation until approval. Coordinate fake-lead-only cloud window and permitted identities without modifying auth users. Verify positive/negative RLS/RPC, current UI regressions, Preview, required CI and review. Report a reviewable PR, actual evidence and gaps; stop before main merge.

## Dispatch and integration
Manager snapshot is committed locally and readable through `codex/leads-foundation`. Child worktrees begin from refreshed main, then rebase their clean branch onto the manager snapshot BEFORE implementation, preserving its live-system instructions and closed scope. Each task commits only its changed files; manager cherry-picks those commits into the feature branch. No child merges main or modifies the other task's files. Separate worktrees are required; do not operate in the management checkout.

Task chats implement themselves and use one actual Sonnet reviewer when available. If unavailable, code may proceed but review remains pending; no silent substitution and no merge-ready claim. The manager dispatches and records NEXT_SESSION rather than polling in a loop. New UI brief will use actual DATA interfaces once ready. No redundant plan-approval question: Alon approved the scope and explicitly requested execution via task chats.
