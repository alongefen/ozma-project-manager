-- Rollback for 20261124150000_hard_delete.sql. NOT a migration: run by hand, only after Alon's yes.
-- It removes the permanent-delete feature. It CANNOT bring back anything that was permanently deleted
-- (no backup on the Free plan). Drain the storage queue first (the app does it on every delete; check
-- `select count(*) from private.storage_deletions` is 0, otherwise those storage files stay behind as orphans).
begin;
drop function public.hard_delete_preview(jsonb);
drop function public.hard_delete_project(jsonb);
drop function public.hard_delete_document(jsonb);
drop function public.hard_delete_entry(jsonb);
drop function public.hard_delete_transaction(jsonb);
drop function public.system_storage_pending(jsonb);
drop function public.system_storage_done(jsonb);
-- Original body from the first migration: every DELETE is refused again for everyone.
create or replace function private.immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='DELETE' then perform private.fail('FORBIDDEN'); end if;
 if TG_TABLE_NAME in ('diary_versions','diary_version_files','diary_attachments','sensitive_events') then perform private.fail('FORBIDDEN'); end if;
 if TG_TABLE_NAME='stored_files' and (to_jsonb(old)->>'state'<>'pending' or to_jsonb(new)->>'state'='pending'
 or (to_jsonb(new)-array['state','mime','size_bytes','sha256','ready_at','display_path','display_state'])
 is distinct from (to_jsonb(old)-array['state','mime','size_bytes','sha256','ready_at','display_path','display_state'])) then perform private.fail('FORBIDDEN'); end if;
 if TG_TABLE_NAME='diary_entries' and (to_jsonb(old)->>'cancelled_at' is not null or
 (to_jsonb(new)->'reporter_id') is distinct from (to_jsonb(old)->'reporter_id') or
 (to_jsonb(new)->'reporter_name') is distinct from (to_jsonb(old)->'reporter_name') or
 (to_jsonb(new)->'entered_at') is distinct from (to_jsonb(old)->'entered_at')) then perform private.fail('FORBIDDEN'); end if;
 if TG_TABLE_NAME='transactions' and (to_jsonb(old)->>'cancelled_at' is not null or to_jsonb(new)->'project_id' is distinct from to_jsonb(old)->'project_id' or to_jsonb(new)->'position' is distinct from to_jsonb(old)->'position') then perform private.fail('FORBIDDEN'); end if;
 return new;
end $$;
drop function private.hard_delete_allows(text);
drop function private.hard_delete_begin(text);
drop function private.hard_delete_end();
drop function private.project_file_ids(uuid);
drop function private.project_has_moved_out_entries(uuid);
drop function private.queue_files(uuid[]);
drop table private.storage_deletions;
-- The audit action list stays wide on purpose: narrowing it fails if any '*.deleted' row exists, and those rows must stay.
commit;
