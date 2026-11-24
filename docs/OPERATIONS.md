# Operations

Scripts that touch the cloud database live in `scripts/ops` and `scripts/import`. All of them are dry-run by default, refuse to write without `--confirm` and the project ref typed by hand, and read secrets only from the environment.

| Script | Purpose | Writes |
|---|---|---|
| `scripts/ops/purge-demo.mjs` | remove all demo data once, before real data | yes, once; never after real data |
| `scripts/ops/seed-accounts.mjs` | create the owner and the developer account | yes |
| `scripts/import/load-projects.mjs` | load the approved projects | yes |
| `scripts/import/extract-website-projects.mjs` | read public website listing pages | no (local file) |

Runbook and order: [GO_LIVE](GO_LIVE.md).

## Support access log (ARCHITECTURE 4.2)

Access by the developer or Supabase/Vercel dashboards to client data is recorded here, one line per access: date, who, why, what was touched. Empty so far.

## Owner recovery

Unchanged: Alon verifies Ben by phone on a known number, runs `system_owner_recovered` and a password reset, and hands the password over by voice. The app has no bypass.

## Standing rules

- Never run the purge after the first real report exists.
- The `SUPABASE_ACCESS_TOKEN` used for the purge is deleted in the dashboard after go-live.
- Backups: Pro daily backups, owned by Alon. Restore tests are not part of this phase (A-21).
