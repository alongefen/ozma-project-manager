# HARD-DELETE: permanent delete by owner-level accounts (A-44)

**Status:** code ready, migration NOT applied. It is applied to the cloud only after Alon types a direct "כן" in this task's chat (D31). Cost 0.

## What it does
Owner-level accounts can permanently delete a cancelled or archived item. Managers, workers and anonymous callers cannot. An active item can never be deleted, not even by an owner.

| Item | Allowed when | Typed name | Deletes |
| --- | --- | --- | --- |
| Project | archived or finished | project name | everything inside: reports and all versions, attachments, documents, transactions, tasks, memberships, finance settings, private data, contact, cover, the project's old log rows, and every storage object |
| Document | archived | file name | the document, its grants, its file (original and display copy) |
| Diary report | cancelled | report date (only if it has files) | all versions, attachments, links, files |
| Transaction | cancelled | none | the transaction and its history |

A minimal row stays in `sensitive_events`: who, when, type, name or id, counts. No content. The old log rows of the deleted item (they hold before/after content) are deleted with it.

## Design
- `supabase/migrations/20261124150000_hard_delete.sql`: `hard_delete_preview`, `hard_delete_project|document|entry|transaction` (owner only, `SECURITY DEFINER`, `search_path=''`, `authenticated` only), `system_storage_pending|done` (`service_role` only), the table `private.storage_deletions`, and four new audit actions.
- **Bypass of "nothing is deleted".** The 7 immutability triggers stay enabled for everybody. `private.immutable()` lets a DELETE through only when (a) the transaction-local setting `ozma.hard_delete` names the running operation, (b) the table belongs to that operation, and (c) the session role is not an API role. The function sets it just before deleting and clears it right after. `set_config(..., true)` is transaction-local, so an error rolls it back too. No `session_replication_role`, no `ALTER TABLE ... DISABLE TRIGGER`. (Also fixed: in a DELETE trigger `return new` would silently cancel the delete, so the allowed path returns `old`.)
- **Storage.** SQL cannot remove storage objects. Order: (1) the DB function deletes the rows and queues every storage path (original and display copy) in `private.storage_deletions`, all in one transaction; (2) the server (`src/features/projects/logic/hard-delete.ts`) lists the queue, removes the objects through the Storage API, in batches; (3) it acknowledges exactly the removed ids.
- **Failure modes.** DB step fails: nothing changes. Storage step fails or the server dies after step 1: rows are gone (no row points to a missing file), the paths stay queued, the result says `storagePending > 0` (the UI shows a notice), and the next permanent delete retries the whole queue. Nothing is silent. Files that were already gone count as removed (idempotent). An owner can still upload to an archived or finished project (owners are always writable), so an owner upload that finishes after its project was deleted would leave one orphan object (rare, accepted).
- **Moved reports.** A project delete also removes the attachments (even when their files belong to another project) of reports that now live in the project. A project that still has the old versions of a report moved OUT of it cannot be deleted (`CONFLICT`, `blockedByMovedEntries` in the preview): those immutable versions name the project. Delete or keep that report first. The project's own tombstones (`document.deleted` etc.) go with the project; only `project.deleted` remains. The queue is read 500 paths at a time, so `storagePending` can under-count when more are queued; it is retried on the next delete.
- **Server is the authority.** The UI hides the button unless owner and eligible, but the database function checks owner, state and name again.

## UI (this version)
"מחיקה סופית" (secondary button, confirmed in a `ConfirmDialog` with a danger confirm button) on the project page (archived or finished, owner only; phone and desktop) and in the documents row menu (archived documents, owner only). The dialog shows what will be deleted with counts and "אי אפשר לשחזר", and asks to type the name. 
**Not in this version:** UI for cancelled diary reports and cancelled transactions. There is no screen that lists them for owners yet. The database functions, server commands and tests exist (`hardDelete` with `kind: 'entry' | 'transaction'`); a screen can call them later. Follow-up for the project manager.

## Rollback
`supabase/rollback/20261124150000_hard_delete.down.sql` (by hand, after Alon's yes): drops the 7 functions, restores the original `private.immutable()`, drops the queue table. **Deleted data cannot be restored** (no backup on the Free plan). The wider audit-action list stays. Check the queue is empty first, otherwise those storage files stay behind.

## Evidence
See "Results" below (filled in as the work progresses).
