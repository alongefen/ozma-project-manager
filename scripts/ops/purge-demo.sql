-- GO-LIVE-PREP: purge ALL demo/test rows from the application tables. Schema, functions, policies,
-- migrations and enum types are untouched. Run only through scripts/ops/purge-demo.mjs after Alon's "כן".
--
-- Sent as ONE multi-statement request, so it runs as one implicit transaction: all or nothing.
-- The 7 immutability triggers ("nothing is physically deleted") are disabled for this transaction only and
-- re-enabled at its end; a failure rolls back the disable too. This is the single approved exception for demo data.
-- (session_replication_role is not available to the Management API role, so the tables' owner switches the triggers.)
begin;
alter table public.diary_versions disable trigger immutable_diary_versions;
alter table public.diary_version_files disable trigger immutable_diary_version_files;
alter table public.diary_attachments disable trigger immutable_diary_attachments;
alter table public.sensitive_events disable trigger immutable_sensitive_events;
alter table public.diary_entries disable trigger immutable_diary_entries;
alter table public.stored_files disable trigger immutable_stored_files;
alter table public.transactions disable trigger immutable_transactions;
delete from public.diary_version_files;
delete from public.diary_versions;
delete from public.diary_attachments;
delete from public.diary_entries;
delete from public.document_grants;
delete from public.documents;
delete from public.project_covers;
delete from public.stored_files;
delete from public.tasks;
delete from public.transactions;
delete from public.sensitive_events;
delete from public.project_finance_settings;
delete from public.project_private;
delete from public.project_contacts;
delete from public.memberships;
delete from public.projects;
delete from private.profile_creation_requests;
delete from private.profile_updates;
delete from public.profiles;
alter table public.diary_versions enable trigger immutable_diary_versions;
alter table public.diary_version_files enable trigger immutable_diary_version_files;
alter table public.diary_attachments enable trigger immutable_diary_attachments;
alter table public.sensitive_events enable trigger immutable_sensitive_events;
alter table public.diary_entries enable trigger immutable_diary_entries;
alter table public.stored_files enable trigger immutable_stored_files;
alter table public.transactions enable trigger immutable_transactions;
commit;
