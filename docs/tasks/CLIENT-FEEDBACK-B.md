# CLIENT-FEEDBACK-B: project notes, extra contacts, company number removed

25.11.2026. Change requests of A-45. Branch `claude/upbeat-gagarin-916d3b`.

## What changed

- **Notes tab ("הערות")** on the project, after the diary: a list of free-text notes, newest first, each with author and server-time written date (and an "edited" time). Add and edit; "delete" is only cancel (`cancelled_at`, hidden afterwards, row kept); the diary-style hard delete (A-44) is not offered for notes. Any member may add on a writable project; edit and cancel only for the author or an owner-level account (same rule as the diary).
- **Extra contacts** (name, role, phone) in the contact card of the project details, phone is a `tel:` link. Everyone on the project reads; managers of the project and owner-level accounts add, edit and remove (`manage(p)`). Removal sets `deleted_at`.
- **Company number removed from the UI**: edit form, new-project wizard and details page, phone and desktop. The form never sends it, the update function keeps the stored value, the column stays. No print or export showed it (checked with `rg`).
- Both shells: `NotesMobile` / `NotesDesktop`, and the same `ExtraContacts` in both details layouts. `loading.tsx` for the notes route, `Pin` action row, shared `Sheet` / `ConfirmDialog` / `IconButton`.

## Deviations from the brief (tell the PM)

- **Table name:** `public.project_contacts` already exists (the single primary contact, `project_id` primary key), so the new table is **`project_extra_contacts`**. Same purpose, cost and rollback as the approved `project_contacts`.
- **Files outside the owned list, minimal edits:** `NewProjectWizard.tsx` and `wizard-model.ts` (the company-number field of the creation form), `view-model.ts` (`sectionsFor` gets the notes tab; `showBusinessNumber` removed), `ProjectForm.tsx`, the project `(tabs)/page.tsx` (loads the contacts) and a new `(tabs)/notes/` route, plus the three existing project screen tests. `src/types/database.ts` is not regenerated (generated file): the two new tables are read through a small untyped cast, `src/features/projects/logic/untyped-db.ts`, to remove after regeneration.
- FKs of the new tables to `projects` use `on delete cascade` (the rest of the schema uses restrict), so the owner's hard delete of a project (A-44) works without redefining its function.

## D31: migration and rollback (approved in principle by Alon in the PM chat 25.11.2026; applying needs his typed "כן" in this session)

- What: two new tables `project_notes`, `project_extra_contacts`, RLS (`select` for `member(p)`, hiding cancelled/removed rows), six `security definer` functions, grants. Nothing existing is touched. Cost: none (Free plan).
- Migration: `supabase/migrations/20261125090000_project_notes_and_contacts.sql` (read it in the PR).
- Rollback, by hand, only after Alon's yes (it deletes every note and extra contact; no backup exists): `supabase/rollback/20261125090000_project_notes_and_contacts.down.sql`:

```sql
begin;
drop function public.create_project_note(jsonb);
drop function public.update_project_note(jsonb);
drop function public.cancel_project_note(jsonb);
drop function public.create_project_contact(jsonb);
drop function public.update_project_contact(jsonb);
drop function public.remove_project_contact(jsonb);
drop table public.project_notes;
drop table public.project_extra_contacts;
commit;
```

## Checks

- Migration applied to `izjmvyguzbampoasvnru` on 25.11.2026 after Alon's typed "כן" in this session (via the Supabase MCP `apply_migration`; no other statement changed schema).
- Local: `tsc --noEmit`, `eslint src tests/logic/project-notes`, `vitest --project unit tests/screens tests/logic/project-notes tests/logic/projects` (235 passed; new `tests/logic/project-notes/notes-contacts.test.ts` covers the RPC routing, validation, permission mapping and the view rules), `next build` passed (route `/projects/[id]/notes` present).
- **Server checks of forbidden cases, run in the cloud DB inside one transaction that was rolled back on purpose** (fake users, sessions and two fake projects; verified afterwards: 0 notes, 0 contacts, 0 test projects, 6 profiles as before). Results: worker creates note OK and a retry returns the same result; manager editing or cancelling a worker's note FORBIDDEN; non-member create NOT_FOUND; unknown project NOT_FOUND; empty body VALIDATION; author edit OK; stale revision CONFLICT; owner edits another's note OK; RLS: worker sees 1 note, non-member 0; cancelled note disappears and cannot be edited (NOT_FOUND); worker create/update/remove contact FORBIDDEN; non-member contact NOT_FOUND; manager creates, updates and removes a contact OK, stored trimmed with an empty role as null; RLS hides removed contacts; on a finished project worker note create/edit/cancel and manager contact create are all PROJECT_READ_ONLY, owner can still write, members still read.
- **Not run:** `tests/logic/project-notes/notes-contacts.cloud.test.ts` (written, typed and linted) could not run: the stored fake owner fixture no longer signs in (the existing `tests/logic/tasks` cloud suite fails the same way at `cloudOwner`, before any of my code). The SQL checks above replace it for this task. **Not checked:** the screens in a browser (no usable sign-in in this environment) at 360/375/390/768/1024/1280, RTL, no horizontal scroll. The layout reuses the task screen classes and shared components, but it is unverified visually. Hard delete of a project that has notes and contacts (cascade) was not exercised.

## Review (one reviewer pass)

No blocking finding. Fixed: a retry after a lost answer reused the request id even for different text (it would have dropped the new text); the id is now kept only for the identical text/contact. Noted: lists are capped at 1000 notes and 200 contacts without paging; a replay of a create returns the original row even if it was cancelled since; hard delete of a project with notes and contacts relies on `on delete cascade` and has no automated test (cloud-test owner fixture is broken).

## Follow-up (Alon, 25.11.2026): contacts in the new-project wizard

- The contact step now takes several contacts (up to 5, add/remove rows: name, role, phone) and none are required. The first filled row becomes the primary contact; the others are saved as extra contacts right after the project is created (a failure leaves the project and shows a message).
- Alon chose **no migration**. The database still requires a primary contact (name and phone, in `create_project`, `update_project` and the table), so with no contact entered the project stores the placeholder name "לא הוזן" and phone "-" (`NO_CONTACT` in `view-model.ts`); the details page shows "לא הוזן" for it. Editing a project with the placeholder still shows the placeholder in the edit form, which keeps the edit form valid. Removing the requirement from the database would need a separate D31 approval.
- Checked: tsc, eslint, 242 unit tests (new cases for contact rows and the split), `next build`. Not checked in a browser (no sign-in); the wizard contact list scrolls inside its step like the permissions list (max-height 250px). The single follow-up diff was self-reviewed, without a second reviewer pass.

## Open items

- Regenerate `src/types/database.ts` and drop `untyped-db.ts`.
- Visual check of the notes tab and the contacts card on phone and desktop by someone with a sign-in.
- Repair or replace the cloud-test owner fixture (`supabase/.temp/p12-owner.json`).
