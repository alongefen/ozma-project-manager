# Demo data (DEMO-DATA)

Three clearly marked, fictional demo projects with people, reports, documents, finance rows and tasks, so a client can feel the system. Everything is fake: project names start with "דוגמה: ", people end with "(דמו)" and use `@example.invalid` addresses, amounts and addresses are invented. The 39 real projects and the three owner accounts are never touched.

Needs a D31 approval before every real run (Alon's direct "כן", in the session that runs it): writes to the production-bound project `izjmvyguzbampoasvnru`, cost 0, no backup exists on the Free plan.

## What the seed creates (counts from the dry run)

| What | Count |
|---|---|
| Projects (2 active, 1 finished) with cover pictures | 3 |
| Demo logins: 2 project managers, 3 workers | 5 |
| Memberships (role lives on the membership) | 10 |
| Finance opened to a manager | 1 (Dana on the building project); Yossi on the same project and Dana on the finished one have it closed |
| Diary reports (2 later corrected, so versions show) | 22 (9 / 7 / 6), by workers, managers and the owner |
| Report attachments: photos and one PDF | 6 |
| Documents (PDF, JPEG rendering, Excel), different categories and access; 3 are owner-only | 12 (5 / 4 / 3) |
| Tasks (5 done, some overdue) | 10 |
| Finance rows over 3 months (3 cancelled, 2 corrected, refunds/credits included) | 34 (13 / 11 / 10) |

All writes go through the app's own database functions, signed in as the owner or as the demo person who "wrote" the item (a report is always written by its own author). Files are generated locally (neutral pictures, `@cantoo/pdf-lib` PDFs with ASCII text, a small `exceljs` file). The finished project is closed last, so everything could still be written first.

## Run

Secrets stay in the environment (`node --env-file=<file>`); nothing is printed or stored. The owner password is passed for that one command only.

```bash
# dry run (offline, counts only)
node --env-file=<env-file> scripts/demo/seed-demo.mjs --owner-email=<an owner email>

# real run, only after the "כן"
GO_LIVE_OWNER_PASSWORD='<owner password>' node --env-file=<env-file> scripts/demo/seed-demo.mjs \
  --owner-email=<an owner email> --confirm --project-ref=izjmvyguzbampoasvnru
```

Env file needs `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`. The five demo passwords are printed once at the end of the run, to the terminal only. A retry never duplicates: every item has a fixed request id and a step in the ledger (re-running prints new passwords, and the old ones stop working).

Every created row, storage path and login is written to `scripts/demo/out/ledger.local.json` (git-ignored, written after each step, so even a crashed run can be removed exactly).

## Remove

```bash
# dry run: counts of what the ledger lists and what exists now, plus any foreign rows
node --env-file=<env-file> scripts/demo/remove-demo.mjs

# real run: needs a separate "כן"; --expect-total must equal the dry-run expectTotal
node --env-file=<env-file> scripts/demo/remove-demo.mjs --confirm --project-ref=izjmvyguzbampoasvnru --expect-total=<n>
```

Env file also needs `SUPABASE_ACCESS_TOKEN` (SQL via the Management API, as in `purge-demo.mjs`).

- **Second approved exception to "nothing is physically deleted".** Diary versions, entries, transactions, files and the action log are protected by seven immutability triggers. Like `scripts/ops/purge-demo.mjs` (same trigger list, same code), the removal switches them off inside ONE transaction, deletes only the ledger's ids, switches them on again and then checks that all are on. A failure rolls everything back and a second safety net re-enables them.
- Refuses: an empty ledger, a ledger id that is not a uuid, a project not named "דוגמה: …", a login not on `@example.invalid`, **any row in a demo project or by a demo login that the ledger does not list** (a real person added something), a role that cannot manage the triggers, a missing or wrong `--expect-total`, a listed id that is not inside a demo project, a storage path that is not under a demo project (in `originals` or `display`).
- If anyone adds a task, report or person to a demo project before the removal, the removal refuses on purpose (the safe side); clean those rows by hand or ask the project manager.
- Known limit: a crash between creating a login/project/upload and writing the ledger leaves an object outside the ledger; the retry or the removal then stops and says so, and it is cleaned by hand.
- After the run it verifies: no ledger row left, triggers enabled, and the real-project count dropped by exactly the demo projects. The ledger is then moved to `ledger.local.json.removed.json`, so a later seed starts clean.
- Rollback of the seed = this removal. There is no backup (Free plan).

## What to show the client

1. **Home**: the three "דוגמה" cards next to the real projects, with covers; the finished one is marked as finished.
2. **Building project**: open it, show the open/overdue/done tasks, then the diary list (different authors, photos, one PDF) and one corrected report (version history). Print a day.
3. **Documents**: categories, a PDF, a rendering, an Excel file; sign in as a worker (Avi) and note that the owner-only and "selected people" documents are not visible to them.
4. **Finance** (as the owner): month totals, the cube, monthly advances, one cancelled row and one corrected row; then the all-projects summary.
5. **People and roles**: the five demo people; Dana (manager) sees finance on the building project, Yossi (manager) does not on the same project; workers never see finance. On the finished project everyone except the owner can only view and print.
6. Say plainly: this is fictional data and will be removed after the meeting.
