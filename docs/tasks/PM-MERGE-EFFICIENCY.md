# PM-MERGE-EFFICIENCY: avoid duplicate merge checks and report promptly

Alon's direct request, 26.11.2026, recorded as A-48.

- AGENTS.md now requires preserving valid tests/review based on content and relevant dependency/configuration impact; a new SHA alone does not invalidate evidence. Required CI remains mandatory.
- Batch task docs before final CI; record late approvals, CI results and merge SHA in the PR body or an authorized comment. Avoid bookkeeping commits that unnecessarily restart CI. No CI workflow changes authorized here.
- Immediately after GitHub confirms merge, report PR link/SHA in Hebrew. Continue authorized deployment/post-merge checks and local synchronization, then report their outcome separately.
- Updated task template and PM handoff so future sessions receive these instructions. Existing D31 and review-model requirements are unchanged.

Verification: documentation diff and consistency review only, per A-36. No code changes, tests, dependency installs, CI changes or manual deployment. Alon explicitly requested main integration. The integration branch carries only this instruction update; NEXT_SESSION and WORK_PLAN conflicts were resolved by retaining main's existing tracking and adding this task's sections. Merge result belongs in the PR body, without a follow-up bookkeeping commit.
