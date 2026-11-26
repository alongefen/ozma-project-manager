# UPLOAD-LOCKFILE: restore reproducible CI installation

## State and ownership
Dispatched on 26.11.2026. Separate serial dependency repair on `codex/upload-lockfile`, based on refreshed `origin/main` at `804f9f7`, in `/private/tmp/ozma-upload-lockfile`.
Only `package-lock.json` and this task file are owned. The PM checkout at `db94007` and upload PR #160 at `04a7a50` are preserved. Recent chat summaries and worktree inventory showed no competing dependency task; upload implementation remains paused.

## Plan and acceptance
1. Reproduce CI's clean-install error using its exact Node/npm versions, without env files.
2. Restore only missing lock metadata, preserving all existing entries and direct declarations.
3. Run ordinary local CI checks/build and remote PR CI, without cloud tests. Production deployment caused by merging #161 was explicitly approved by Alon on 26.11.2026.
4. Obtain one independent reviewer before merge. On 26.11.2026 Alon explicitly instructed this task to use Sol instead of Sonnet.
5. After review and green CI, rebase, merge the separate PR and fast-forward local main; then return #160 to its existing task owner.

## Red evidence and cause
- Failed CI run `45804509584`: Node `24.22.3`, npm `11.19.1`.
- Fresh local `npm ci` with that exact combination failed with EUSAGE and missing `@emnapi/runtime@1.11.3` / `@emnapi/core@2.0.0-beta.2`, matching CI.
- The lock already referenced runtime `^1.11.3` from optional Sharp wasm and core `2.0.0-beta.2` from optional Rolldown wasm, but lacked the corresponding root package records. Existing bundled Tailwind records and nested Rolldown runtime do not satisfy those paths.

## Exact dependency delta
`npm install --package-lock-only --ignore-scripts --no-audit --no-fund` with CI's npm supplied the missing records. Unrelated peer-flag normalization was discarded.
The final lockfile diff adds exactly 22 lines: two package records with registry URLs, integrity hashes, licenses, optional/dev flags and their already-locked dependencies. A structural comparison confirms every original package entry remains identical, with no removed records, version/resolution changes or direct dependency changes. Existing package ordering is preserved.

## Verification
All local checks used Node `24.22.3` / npm `11.19.1` in the new worktree without env files; chained verification exited 0.
- Fresh `npm ci`: PASS (595 installed packages); final 22-line lock diff preserved.
- `node --test .github/scripts/change-scope.test.mjs`: 18 passed.
- `npm run lint` and `npm run typecheck`: PASS.
- `npm run test:foundation`: 1 passed, Linux-only Chromium smoke skipped on macOS.
- `npm test -- --passWithNoTests --reporter=dot`: 83 files / 1,122 tests passed; 2 files / 9 tests skipped.
- `NEXT_TELEMETRY_DISABLED=1 npm run build`: PASS.
- Full lock diff and `git diff --check`: PASS; structural comparison verified all existing entries unchanged.
Remote CI [run 45805605602](https://github.com/alongefen/ozma-project-manager/actions/runs/45805605602) on implementation commit `94ea261` completed SUCCESS with the same Node/npm combination: fresh npm ci, scope tests, lint, typecheck, both foundation checks (including Linux Chromium), 85 unit-test files / 1,127 tests passed (4 skipped), and build. The logs were read.

## Reviewer and limits
Alon explicitly approved Sol for this review on 26.11.2026 ("תשתמש בsol לביקורת"). One `reviewer` subagent ran on GPT-6.1 Sol and approved the change without blocking findings. The reviewer independently verified the exact structural delta, unchanged package.json/CI, `git diff --check`, and a fresh npm ci (595 packages) under Node 24.22.3/npm 11.19.1; it read successful CI run `45806072640` on `39f7913` (1,127 tests and build). It did not repeat unchanged full checks. Its sole documentation finding, stale Sonnet/Handoff status, is corrected here. The review gate is closed.

### Production approval
Read-only Vercel history shows READY production deployments for the two latest main merges: #159 / `804f9f7` (`dpl_44gthzPuKKKF9C6m5SQ1cXYMrpMe`) and #158 / `ac63c7e` (`dpl_5S6fM5QX4UwaaGQhVHg3mvPybdwA`). This demonstrated that merging #161 can trigger production automatically, so execution paused under the original no-production limit. The project connector omits Git deployment settings and a read-only CLI settings request returned 403; no settings were changed. Alon explicitly resolved that boundary on 26.11.2026: "מאשר למזג את #161 גם אם זה מפעיל פריסת production אוטומטית. תעדכן בסיום." This authorizes this merge and its automatic production deployment only. No new service is required; existing Vercel build usage may apply. A production rollback would return traffic to the current known deployment; reverting the lockfile in Git would restore the original installation failure.
No cloud tests, env-value reads, migrations, services or manual deployment commands. GitHub/Vercel attached preview checks to the PR. The authorized merge may trigger production automatically; verify its source SHA and READY state before reporting completion. No upload implementation changes or repeated upload acceptance checks. The Linux Chromium smoke skipped on macOS passed in remote CI.

## Handoff
Reviewed PR [#161](https://github.com/alongefen/ozma-project-manager/pull/161), implementation commit `94ea2612dc8fe4407ab67ad25ff345e02ced258c`. Fetched and rebased onto `origin/main` after the implementation commit; the base remained `804f9f7` with no incoming content. Remote CI run `45805605602` passed. This documentation follow-up does not alter the verified lockfile. Final pre-merge CI on `b00e0c1` passed in run `45806940310`; the approval record changes only documentation. Merge after final green CI, fast-forward local main, preserve the PM checkout and #160 worktree, and record the actual merge SHA/deployment outcome in the PR completion evidence. The production boundary is resolved. After this repair merges, the existing #160 owner should rebase and complete that task's remaining gates; this task does not modify #160. Sol review is complete; its authorization applies to this task only. Existing unchanged upload evidence stays valid; its remaining full Next/live storage and real-device gates stay with that task.
