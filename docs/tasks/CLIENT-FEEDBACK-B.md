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

STATUS_PLACEHOLDER
