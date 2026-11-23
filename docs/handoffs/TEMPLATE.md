# <ID>: <short title>

Brief template (A-39). Keep it under about 40 lines: the brief is the session's first message, and every later call re-sends it.

You are the task session for <ID>. Build the code yourself, then run one `reviewer` subagent before the PR. Use `builder` only for a large, isolated piece. Talk to Alon in Hebrew. Write docs and code in English.

## State
- Depends on: <PR/SHA already merged>. Ready to start: yes / blocked by <X>.
- Existing branch or worktree: <none / name>. Continue it; don't restart.

## Read (only these)
- AGENTS.md (already loaded), `docs/tasks/<ID>.md`, WORK_PLAN § <ID>.
- <doc> § <section>, for example ARCHITECTURE 5.10 or PERMISSIONS P26. Use `rg`/`sed -n`, never a whole doc.
- Code: <the exact contract and module paths>.

## Owned files
- <globs>. Anything else means stop and tell the project manager.

## Build
- <3–8 bullets: what to build, using which existing APIs, and what is out of scope>.

## Done
- <the concrete behaviours, including the forbidden cases checked on the server>.
- Tests: only the affected suites (A-36). Cloud tests: <allowed / ask the PM for a window>.
- `docs/tasks/<ID>.md`: what changed, what was checked, the results, and what is still open.
- One reviewer pass → fix the findings → rebase → PR → merge → fast-forward `main` (A-32).

## Limits
- No migrations, new services, costs or deployment without D31 approval. Fake data only.

Report back in at most 10 lines: what was built, the tests and their results, the limits, and the PR link with the merged SHA.
