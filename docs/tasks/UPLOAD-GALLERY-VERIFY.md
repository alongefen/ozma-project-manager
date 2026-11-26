# UPLOAD-GALLERY-VERIFY: restore selection after #158

## State (PM inspection, 26.11.2026)
- Alon: after #158, selecting a photo has no visible effect or error; previously some photos uploaded.
- #158 merged at `ac63c7e`; current main `804f9f7` includes #159.
- Existing #160 is OPEN: `claude/upload-gallery-fix`, `1d68bc2626ec5db80f49faab4c5e4dc80e1a1bba`, clean worktree `.claude/worktrees/sad-swirles-00f0fe`. Continue it.
- Diff explains the silent failure: the input is cleared while holding a live FileList; #160 snapshots it into an array first in both picker and camera handlers. This is code evidence, not a browser reproduction by the PM.
- CI run `45801710940` failed at npm ci, missing `@emnapi/runtime@1.11.3` and `@emnapi/core@2.0.0-beta.2` from lockfile. Later checks did not run. Vercel preview status succeeded; this proves neither upload behavior nor production delivery.

## Implementation and verification plan
1. Check no other session owns the existing branch/worktree; preserve any later work. Rebase onto current origin/main.
2. Use the existing browser/test tooling with synthetic files and intercepted upload endpoints to reproduce the actual input selection failure on #158, then verify #160. Do not substitute only a mime-helper test for the input handler.
3. Cover picker and camera inputs, multiple selection where allowed, selecting the same file again, cancellation, visible progress and a visible server/read error. No new dependency without a serial shared change.
4. Check affected consumers (document, diary, cover) on phone and desktop; no new layout scope. Consult UI_CONVENTIONS for UI changes.
5. Run affected suites, lint/types as appropriate; one reviewer pass per A-39. Record exact evidence and limitations below. If required reviewer model is unavailable, report it; do not claim a Sonnet review.
6. Resolve failed installation before merging. If a lockfile change is needed, stop for a serial shared-file task; do not silently expand ownership or skip CI.
7. PR → merge → fast-forward main only after review and checks. No deployment, migrations or production writes without specific D31 approval. Tests must not create visible fake users in the live client's database.

## Limits
- Original intermittent gallery failure remains unproven. Fixing the deterministic regression does not establish its cause or resolution.
- No secrets or customer images in logs, tests, git or handoffs. No env file inspection/copying.
- PM inspected Git, #158/#160 metadata/diff and failed CI log; no tests or browser reproduction performed, no cloud data changed. Task session launched at Alon's explicit request on 26.11.2026: `01a2176e-ade2-77d2-b2e3-d0e2d87701ef` on host `local`; instructed to start immediately in the existing implementation worktree.

## Task-session evidence
### Reproduction and checks (26.11.2026)
- Continued existing clean worktree/branch `claude/upload-gallery-fix`, PR #160 at `1d68bc2`. Listed current Codex chats/worktrees: no competing upload implementation found. Fetched origin and rebase reported up to date with `804f9f7`. PM checkout and its uncommitted work were preserved.
- Added `tests/screens/files/upload-selection.spec.ts`: actual React components served by the already-installed Vite runtime, real Chromium file-input/filechooser selection, intercepted begin/TUS/complete endpoints and synthetic bytes. Next navigation and consumer server actions are stubbed; no Next app/auth or live server is exercised. Vite env loading is disabled and external browser requests are aborted.
- RED: `UPLOAD_SELECTION_BASELINE=1` serves the exact `FileUpload.tsx` from `ac63c7e`. All 4 picker/camera cases fail at 390/1280px because no completed upload item appears after selection (received 0). No baseline source mutation was needed.
- GREEN: same suite against #160: **14 passed**. Covers picker multiple files and unchanged original bytes, reselecting the same file, camera, empty/cancelled selections, visible in-flight progress, diary submit lock/unlock, non-JSON HTTP 503, complete validation failure, unreadable Blob, document access prerequisite and result callback, diary attachment submission, cover binding callback. Consumer fixtures are Hebrew RTL at 390/1280px with no horizontal overflow.
- Full unit suite: **83 files passed, 2 skipped; 1122 tests passed, 9 skipped**. First sandboxed run could not launch the existing PDF browser test; rerun with browser execution allowed passed. Expected synthetic error logs are present in existing negative tests.
- `tsc --noEmit`, focused ESLint on the component/new spec, and full `npm run lint` passed. No production logic beyond the existing two-handler snapshot fix was added.
- Environment: installed dependencies, Node 25.2.1 (CI requires Node 24); Playwright 1.65.1 with the existing cached Chromium headless shell revision 1248. This is local verification, not a successful fresh CI installation.

### Repeat the isolated browser checks
Create a temporary Playwright config outside the repo (no shared configuration ownership change):
```sh
cat > /tmp/ozma-upload.playwright.config.ts <<'CONFIG'
export default {
  testDir: '/Users/alongefen/ozma-project-manager/.claude/worktrees/sad-swirles-00f0fe/tests/screens/files',
  testMatch: 'upload-selection.spec.ts', workers: 1, reporter: 'dot',
  outputDir: '/tmp/ozma-upload-results',
  use: { browserName: 'chromium', launchOptions: {
    executablePath: '/Users/alongefen/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell'
  } },
};
CONFIG
# From the existing implementation worktree; baseline must fail four selection cases:
UPLOAD_SELECTION_BASELINE=1 node_modules/.bin/playwright test --config=/tmp/ozma-upload.playwright.config.ts --grep 'picker snapshots|camera selection'
# Fixed component; all checks must pass:
node_modules/.bin/playwright test --config=/tmp/ozma-upload.playwright.config.ts
```
Use the installed Playwright browser default on other machines, or an existing compatible local executable. No browser/dependency installation was performed here.

### Review and remaining gates
- Independent reviewer (default available Codex model, not Sonnet): **approve for local code**, no blocking code findings. Independently ran 13 focused unit tests and 14 Chromium checks, all passing, and repeated the four expected baseline failures. CI and required Sonnet gates remain unmet. Sonnet is unavailable in the Codex subagent model catalog; this review does not claim to satisfy that model requirement.
- Reviewed evidence/tests were committed and pushed as `f0bc41efe717ff6f78196037b03cb2cbd4973893`; the worktree was clean after push. Fresh CI run `45804367962` on that commit failed again at `npm ci` with the same two missing entries. No CI bypass or merge was attempted.
- CI remains blocked by `npm ci` (original run `45801710940`, reconfirmed in `45804367962`): missing `@emnapi/runtime@1.11.3` and `@emnapi/core@2.0.0-beta.2`. Inspection confirms their dependency references but no matching top-level lock entries. `package.json`, `package-lock.json` and CI were not changed. A separate serial dependency owner must repair installation; do not bypass the failed check or merge while red.
- Browser spec is outside the default `tests/e2e` discovery directory and is run explicitly with the config above. Wiring it into CI/default Playwright discovery is a shared-config follow-up, not silently included in this task.
- No merge SHA yet; PR #160 remains open. Main was not changed or fast-forwarded because the merge gate is not met.
- Not tested: real phone/camera/gallery/cloud-only media, full Next app navigation/auth, live storage/server refusal checks, fresh Node 24 install/build, other viewport widths. No layout was changed. No cloud test window was allocated and no cloud tests/users/data were created.
- No deployment or production acceptance performed. Original intermittent gallery failure remains open. Next owner: serial dependency task for lockfile/green CI, then task session for remaining review/merge gates and PM for separately authorized delivery/real-device acceptance.
