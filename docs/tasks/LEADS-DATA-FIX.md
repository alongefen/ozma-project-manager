# LEADS-DATA-FIX: persisted email validation parity

## Concrete review finding
Reviewer GPT-6.1 Sol found one P2 in DATA `a67ad3e` / integration `8931860`: SQL email check in `supabase/migrations/20261126160000_leads_foundation.sql` line 73 accepts `a@b.c` and `a..b@example.com`, while `LeadFieldsSchema` / `LeadRowSchema` use Zod `z.email()` and reject them. A permitted owner can call RPC directly, persist such email and make the list mapper fail for the entire result. Fix before D31 application.

## Scope and execution
- Continue from the manager snapshot provided in dispatch, in a separate task worktree/branch `codex/leads-data-email-fix`. Build yourself, no cloud writes. Read AGENTS, finalized LEADS spec, DATA delivery contract and the exact reviewed SQL/schema only as needed.
- Change only the proposed migration's email validation and `tests/logic/leads/sql.test.ts` (or one focused parity test), plus this note. UI concurrently changes actions/screens/navigation; do not edit its files or the shared contract. Required file changes are authorized, but coordinate actual overlap.
- Match the current pinned Zod email validation semantics in persisted SQL. Do not loosen the application contract merely to avoid the finding. Test the two reported values rejected and ordinary valid plus-address/subdomain emails accepted; cover case, optional null and length contract without an unnecessary broad suite. Inspect the actual pinned Zod regex instead of guessing. No dependency update.
- No SQL execution/compilation against live DB, auth-user changes, secrets/env value reads, migration application, deployment, push/PR/main merge. Existing cloud constraints remain in force. This is a proposal correction, not approved D31.
- Run focused local parity/SQL checks, preserve unaffected 50-test evidence under A-48; use pipefail/quiet reporter. Record results and exact revised D31 impact (validation only), commit named files and return SHA.
- Do not spawn another reviewer. The manager will return only your changed lines to the original DATA reviewer for the concrete P2 finding, under one-review/A-48. Sonnet fallback GPT-6.1 Sol is authorized in AGENTS/main `189d65d`.
