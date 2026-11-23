# PM-TOKEN-EFFICIENCY

23.11.2026. Decision A-39. Docs and agent config only; no code, cloud or migrations.

## Why

Token audit of the 22.11 transcripts (Pro plan, every session and subagent on Opus). Between 17:30 and 18:05, the manager, 4 task sessions and about 10 subagents used about 69M input tokens.

- 86% of the tokens went to the long-lived coordinator sessions: the manager averaged about 334k of context per call, and the task managers 170–235k.
- Each session started at about 100k tokens before any work.
- The subagents accounted for only 14%.

## What changed

- `.claude/agents/reviewer.md` and `.claude/agents/builder.md` were added. Both run on `model: sonnet` and return short reports.
- `AGENTS.md` was rewritten in English, at about half its length, and now has the A-39 workflow: two layers, at most 2 parallel sessions, a short-lived manager, docs-only changes inline, and short output. Its product, D31, Git and done rules are kept.
- `docs/handoffs/TEMPLATE.md` was added: a brief of about 40 lines.
- `docs/handoffs/PROJECT_MANAGER.md` was rewritten in English for the new manager role.
- DECISIONS A-39 was added, and short pointers were added to WORK_PLAN and NEXT_SESSION.

## Checked

- One diff read for consistency with A-26, A-30, A-33, A-34, A-36 and D31.
- No code checks were run, per A-36.

## Not done

- These are Alon's local settings and were not changed here:
  - Disable the MCP servers this project doesn't use (Vercel until deploy, Garmin, Higgsfield, n8n, Paper).
  - Set the model of the manager and task sessions in the app.
- The existing briefs and task files stay in Hebrew until they're rewritten.
