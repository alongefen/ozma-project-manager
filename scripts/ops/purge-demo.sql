-- GO-LIVE-PREP: purge ALL demo/test rows from the application tables. Schema, functions, policies,
-- migrations and enum types are untouched. Run only through scripts/ops/purge-demo.mjs after Alon's "כן".
--
-- Sent as ONE multi-statement request, so it runs as one implicit transaction: all or nothing.
-- session_replication_role=replica (local to that transaction) switches off the immutability triggers
-- ("nothing is physically deleted") and FK checks. This is the single approved exception for demo data.
set local session_replication_role = replica;
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
