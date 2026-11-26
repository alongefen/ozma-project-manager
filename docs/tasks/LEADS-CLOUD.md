# LEADS-CLOUD: concrete D31 approval request and bounded verification

## Approval state
Pending Alon's explicit approval. No cloud SQL or writes have run. Functional scope is approved; this operational request is distinct from product approval and from the later release/main-merge gate. Migration reviewed after original DATA review and narrow P2 correction: source `6becf18`, integrated `b72c22a`. Original reviewer on authorized GPT-6.1 Sol confirmed the finding resolved with no new finding. Reported focused checks: 23 passing tests and scoped lint; unaffected original DATA/ISOLATION evidence retained.

## Exact requested database change
Target existing live Supabase Cloud project `izjmvyguzbampoasvnru` (Ireland).
Apply only `supabase/migrations/20261126160000_leads_foundation.sql`, current SHA-256 `c02075bba3012f37e432c3f4c7ee0c0d081d748c59d7e56a134ce50ad2b1c175`. Verify pending migration history/schema before application; stop if additional pending migrations, a pre-existing leads object, unexpected schema drift or required shared modification is found. Never reset or rerun existing migrations.

Adds one global `public.leads` table, required business fields, soft-delete/archive metadata, creator/request idempotency and revision. Adds SELECT policy for active owner-level accounts, two partial indexes plus constraint indexes, four private helper functions and five owner-checked public RPCs: create_lead, update_lead, set_lead_status, set_lead_archived, delete_lead. Authenticated direct writes are revoked; anon/service-role table access revoked; active-owner/session guards independently enforced inside RPCs. No existing table row, policy, function, auth user, trigger, storage bucket, integration or client screen is changed. Detailed object/grant/locking inventory is in LEADS-DATA's Concrete D31 request.

Generate actual DB types only after successful approved application. Run nonmutating targeted schema/permission diagnostics, not unrelated broad suites. No new service/plan/fixed cost proposed; uses existing DB storage/compute. Actual quota/headroom and variable usage costs are unverified; stop before any new cost/service decision.

## Requested bounded test-write window
One exclusive window after migration and UI readiness. At most 20 fake lead rows, each with a run-unique `LEADS-TEST-<UUID>` name marker and synthetic contact values. Use only already authorized existing identities/sessions; no auth-user creation, profile/membership changes, disabling users or business/project writes. If a forbidden-role/session case cannot be exercised with existing identities, record it as unverified; do not create or alter identities to manufacture coverage.

Cover allowed admin operations, forbidden non-admin/anon/direct table writes, canonical duplicate warning (no insert), explicit override, same-request retry and bounded concurrency, revision conflicts, archive/restore, soft deletion and deleted invisibility, and targeted read-only current-system regression evidence. Full disabled/revoked/service-role coverage only if existing safe identities/credentials permit it under the no-secret/no-user-change rules. No broad cloud suites/fixtures/seeds/resets.

Clean up only this run's marked fake lead rows through approved soft-delete RPC. This intentionally retains their records in the DB as deleted, just like product deletion. No physical cleanup is requested or authorized. Alon's approval must include acceptance of retaining those soft-deleted fake records; otherwise agree cleanup separately before test writes. Do not touch pre-existing rows, including other tests' leads. Record exact count, IDs privately as operational evidence and cleanup result without exposing client data.

## Containment rollback
Prepared at `supabase/rollback/20261126160000_leads_foundation.down.sql` (outside migrations). If an approved operational window includes containment on failure, disable feature availability, revoke access to the leads table and five RPCs, and preserve all rows/schema/retry keys. This returns feature access to closed state; it does not restore the prior schema by dropping objects. Existing business data/auth unchanged. Do not delete data, remove objects, rerun migration or re-enable grants without a separate explicit decision. Ask to include this exact containment script on failure in the operational approval; rollback has not run.

## Preview and release boundary
Existing Preview service workflow already approved. UI task works locally until integration. Cloud test approval does not authorize production UI activation/main merge/promotion/alias. Production route/actions/navigation remain blocked independently of RLS. Preview uses this same real DB; record what was actually verified. No claim of hosted/Preview success before execution.

## Next owner
Alon approves the exact additive migration, generated types/read-only diagnostics, up to 20 run-marked fake lead writes with retained soft-deleted records, and the access-only containment rollback on failure; then feature manager coordinates execution without duplicate chats. A later explicit release approval is still required before main merge.
