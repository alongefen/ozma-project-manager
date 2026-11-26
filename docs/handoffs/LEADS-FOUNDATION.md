# LEADS-FOUNDATION: leads data and UI

You are the task session for LEADS-FOUNDATION. Talk to Alon in Hebrew; docs/code in English. Build the code yourself after scope and ownership are settled, then run one reviewer under A-39. Do not substitute a different reviewer model silently if Sonnet is unavailable.

## State
- Alon opened this next phase on 26.11.2026 (A-49): data structure and UI only.
- Alon will send screenshots of the desired UI and lead information here. Start by receiving them; do not invent the schema or restore old demo requirements.
- No existing leads branch/worktree identified. Before implementation, refresh origin/main and use an isolated task branch; preserve other work. The PM preparation branch is `codex/pm-leads-foundation`.

## Read (only these)
- AGENTS.md, `docs/tasks/LEADS-FOUNDATION.md`, WORK_PLAN § LEADS-FOUNDATION, DECISIONS § A-49 and D31 in AGENTS.
- Before screens: `docs/UI_CONVENTIONS.md`. Before data/logic: ARCHITECTURE §§ 3.2, 5.1–5.3 and PERMISSIONS §§ 1–4, then only relevant existing contracts/modules. Use rg/sed, never whole long docs.

## Owned files
- `docs/tasks/LEADS-FOUNDATION.md` only at first. Record screenshot-based design, open decisions and proposed exact code/shared-file list; return that list to the PM for allocation before code. Shared docs remain PM-owned.

## Build
- Extract fields and layout from screenshots; clarify missing permissions, scope and operations with Alon. Present the design before implementation.
- Data, RLS and write functions first, then shared logic and dedicated Hebrew/RTL phone and desktop UI.
- No webhook, external forms/campaign intake, Make, GREEN API, secrets or messaging. Future integrations are context, not current scope.
- Prepare concrete migration/rollback and cost information before seeking D31 approval; do not apply SQL or deploy on general feature approval.

## Done
- Record actual checks/results/gaps in the task file. Verify forbidden reads/writes on the server and affected tests; obtain a cloud-test window before any test writes. Never assume this DB is development-only.
- UI: shared headers/components/loading, all six required widths, Hebrew RTL and no horizontal scroll.
- One reviewer → fixes → fetch/rebase and assess incoming delta → required CI → PR/merge → immediate Hebrew merge link/SHA → authorized follow-up and fast-forward main. Preserve unchanged evidence under A-48; batch docs before final CI.
- No deployment without explicit D31 approval. Fake data only, with cleanup limited to the task's own rows; protect real data and secrets.

First response: briefly acknowledge the scope and ask Alon to send the screenshots and lead fields so you can define the implementation.
