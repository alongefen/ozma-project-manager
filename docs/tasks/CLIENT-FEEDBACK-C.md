# CLIENT-FEEDBACK-C: clean home screen, optional task assignee

25.11.2026. Change requests of A-45 / A-46 (PM records A-46).

## Part 1: customers card removed (no migration)

- The "לקוחות" counter card is gone from the home screen (`counterItems`). Three cards remain: active projects, reports today, open tasks.
- Phone / tablet shell (< 1024px): the open-tasks card is the odd last card and spans the full width. Desktop: three equal columns, no gap.
- The `counters.customers` value is still computed and in the contract (unused by the UI); removing it would touch the shared contract, left for a later cleanup.
- Checked: `vitest` overview logic + screen tests (21 pass), `tsc --noEmit`, `eslint src/features/overview`. Not checked in a browser at 360–1280 (no signed-in session in this worktree); the CSS change is two rules.

## Part 2: optional task assignee

Pending: SQL + rollback, then Alon's "כן" in the task chat (D31).
