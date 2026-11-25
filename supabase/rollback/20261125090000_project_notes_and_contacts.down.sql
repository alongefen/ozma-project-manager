-- Rollback for 20261125090000_project_notes_and_contacts.sql. NOT a migration: run by hand, only after Alon's yes.
-- Drops only objects that migration created. It deletes every note and extra contact (no backup on the Free plan).
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
