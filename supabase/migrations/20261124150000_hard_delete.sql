-- HARD-DELETE (A-44): owner-level accounts may permanently delete a cancelled/archived/finished item.
-- Rollback: supabase/rollback/20261124150000_hard_delete.down.sql (not a migration; never auto-applied).
-- Deleted data CANNOT be restored (no backup on the Free plan).
--
-- Design:
--  * One SECURITY DEFINER function per item type, owner only, state checked inside, typed name checked inside.
--  * The immutability triggers stay enabled for everybody. private.immutable() lets a DELETE through only when a
--    transaction-local setting names the running operation AND the table belongs to that operation AND the session role is
--    not an API role. The setting is cleared before the function returns and vanishes on any error (is_local = true).
--  * Storage objects cannot be removed from SQL. The function deletes the rows and, in the same transaction, queues every
--    storage path in private.storage_deletions. The server removes the objects through the Storage API and then
--    acknowledges. A failure leaves queued rows (detectable and retried), never a row pointing to a missing file.

alter table public.sensitive_events drop constraint sensitive_events_action_check;
alter table public.sensitive_events add constraint sensitive_events_action_check check(action in
 ('user.created','user.updated','user.active_changed','user.password_reset',
 'membership.changed','membership.removed','membership.finance_changed','project.created','project.updated',
 'project.status_changed','project.archive_changed','project.cover_changed','document.created','document.replaced',
 'document.access_changed','document.archive_changed','task.deleted','entry.corrected','entry.moved','entry.cancelled',
 'transaction.created','transaction.updated','transaction.cancelled','finance.link_changed','owner.created','owner.password_recovered',
 'owner.demoted','project.deleted','document.deleted','entry.deleted','transaction.deleted'));

create table private.storage_deletions (
 id bigint generated always as identity primary key, bucket text not null, path text not null,
 created_at timestamptz not null default now(), unique(bucket,path)
);
alter table private.storage_deletions enable row level security;
revoke all on private.storage_deletions from public,anon,authenticated,service_role;

-- Which tables a running hard delete may delete from. Empty outside a hard delete and for every API role.
create function private.hard_delete_allows(t text) returns boolean language sql stable set search_path='' as $$
 select current_user not in ('anon','authenticated','authenticator','service_role','supabase_auth_admin')
 and case coalesce(current_setting('ozma.hard_delete',true),'')
  when 'project' then t in ('diary_versions','diary_version_files','diary_attachments','sensitive_events','diary_entries','stored_files','transactions')
  when 'document' then t in ('stored_files','sensitive_events')
  when 'entry' then t in ('diary_versions','diary_version_files','diary_attachments','diary_entries','stored_files','sensitive_events')
  when 'transaction' then t in ('transactions','sensitive_events')
  else false end
$$;
create function private.hard_delete_begin(scope text) returns void language plpgsql set search_path='' as $$
begin perform set_config('ozma.hard_delete',scope,true); end $$;
create function private.hard_delete_end() returns void language plpgsql set search_path='' as $$
begin perform set_config('ozma.hard_delete','',true); end $$;

-- Same body as before; the only change is the DELETE branch (and "return old" for an allowed delete,
-- because "return new" in a DELETE trigger would silently cancel it).
create or replace function private.immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='DELETE' then
  if private.hard_delete_allows(TG_TABLE_NAME) then return old; end if;
  perform private.fail('FORBIDDEN');
 end if;
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

-- Queue every storage object of the given files (original and display copy). Returns the queued rows.
create function private.queue_files(file_ids uuid[]) returns jsonb language sql security definer set search_path='' as $$
 with src as (
  select bucket as b, object_path as p from public.stored_files where id=any(file_ids)
  union select 'display', display_path from public.stored_files where id=any(file_ids) and display_path is not null),
 q as (insert into private.storage_deletions(bucket,path) select b,p from src on conflict do nothing returning id,bucket,path)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'bucket',bucket,'path',path)),'[]'::jsonb) from q
$$;
-- Every file a project delete removes: the project's own file rows (documents, cover, pending uploads) plus the attachments of the
-- entries that currently live in the project (their files may belong to another project if the entry was moved in).
create function private.project_file_ids(p uuid) returns uuid[] language sql stable security definer set search_path='' as $$
 select coalesce(array_agg(distinct f),'{}'::uuid[]) from (
  select id as f from public.stored_files where project_id=p
  union select file_id from public.diary_attachments where entry_id in (select id from public.diary_entries where project_id=p)) x
$$;
-- Old versions of an entry moved OUT of the project still name the project (immutable rows). Those block the delete.
create function private.project_has_moved_out_entries(p uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.diary_versions v join public.diary_entries e on e.id=v.entry_id where v.project_id=p and e.project_id<>p)
$$;

-- Read-only: what a permanent delete would remove, and whether it is allowed now.
create function public.hard_delete_preview(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare k text; target uuid; p public.projects; d public.documents; f public.stored_files; e public.diary_entries; t public.transactions; n int;
begin
perform private.require_owner(); perform private.keys(input,array['kind','id']::text[],array['kind','id']::text[]);
k:=input->>'kind'; target:=(input->>'id')::uuid;
if k='project' then
 select * into p from public.projects x where x.id=target; if not found then perform private.fail('NOT_FOUND'); end if;
 return jsonb_build_object('kind',k,'name',p.name,'confirmName',p.name,'requiresName',true,
  'eligible',(p.archived_at is not null or p.status='completed') and not private.project_has_moved_out_entries(p.id),
  'blockedByMovedEntries',private.project_has_moved_out_entries(p.id),
  'counts',jsonb_build_object('reports',(select count(*) from public.diary_entries where project_id=p.id),
   'versions',(select count(*) from public.diary_versions where project_id=p.id),
   'documents',(select count(*) from public.documents where project_id=p.id),
   'transactions',(select count(*) from public.transactions where project_id=p.id),
   'tasks',(select count(*) from public.tasks where project_id=p.id),
   'files',cardinality(private.project_file_ids(p.id))));
elsif k='document' then
 select * into d from public.documents x where x.id=target; if not found then perform private.fail('NOT_FOUND'); end if;
 select * into f from public.stored_files where stored_files.id=d.file_id;
 return jsonb_build_object('kind',k,'name',f.original_name,'confirmName',f.original_name,'requiresName',true,'eligible',d.archived_at is not null,
  'counts',jsonb_build_object('files',1));
elsif k='entry' then
 select * into e from public.diary_entries x where x.id=target; if not found then perform private.fail('NOT_FOUND'); end if;
 select count(*) into n from public.diary_attachments where entry_id=e.id;
 return jsonb_build_object('kind',k,'name',to_char(e.work_date,'DD/MM/YYYY'),'confirmName',to_char(e.work_date,'DD/MM/YYYY'),'requiresName',n>0,
  'eligible',e.cancelled_at is not null,
  'counts',jsonb_build_object('versions',(select count(*) from public.diary_versions where entry_id=e.id),'files',n));
elsif k='transaction' then
 select * into t from public.transactions x where x.id=target; if not found then perform private.fail('NOT_FOUND'); end if;
 return jsonb_build_object('kind',k,'name',null,'confirmName',null,'requiresName',false,'eligible',t.cancelled_at is not null,'counts',jsonb_build_object());
else perform private.fail('VALIDATION','kind'); end if;
return null;
exception when invalid_text_representation then perform private.fail('VALIDATION'); return null;
end $$;

create function public.hard_delete_project(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.projects; queued jsonb; counts jsonb; fids uuid[];
begin
perform private.require_owner(); perform private.keys(input,array['id','confirmName']::text[],array['id','confirmName']::text[]);
select * into p from public.projects where id=(input->>'id')::uuid for update;
if not found then perform private.fail('NOT_FOUND'); end if;
if not (p.archived_at is not null or p.status='completed') then perform private.fail('CONFLICT','not_deletable'); end if;
if private.project_has_moved_out_entries(p.id) then perform private.fail('CONFLICT','moved_entries'); end if;
if btrim(input->>'confirmName') is distinct from btrim(p.name) then perform private.fail('VALIDATION','confirmName'); end if;
fids:=private.project_file_ids(p.id);
counts:=jsonb_build_object('reports',(select count(*) from public.diary_entries where project_id=p.id),
 'documents',(select count(*) from public.documents where project_id=p.id),
 'transactions',(select count(*) from public.transactions where project_id=p.id),
 'files',cardinality(fids));
queued:=private.queue_files(fids);
perform private.hard_delete_begin('project');
delete from public.document_grants where project_id=p.id;
delete from public.project_covers where project_id=p.id;
update public.documents set replaces_document_id=null where project_id=p.id and replaces_document_id is not null;
delete from public.documents where project_id=p.id;
delete from public.diary_version_files where entry_id in (select id from public.diary_entries where project_id=p.id);
delete from public.diary_attachments where entry_id in (select id from public.diary_entries where project_id=p.id);
delete from public.diary_versions where entry_id in (select id from public.diary_entries where project_id=p.id);
delete from public.diary_entries where project_id=p.id;
delete from public.transactions where project_id=p.id;
delete from public.tasks where project_id=p.id;
delete from public.stored_files where id=any(fids);
delete from public.project_finance_settings where project_id=p.id;
delete from public.project_private where project_id=p.id;
delete from public.project_contacts where project_id=p.id;
delete from public.memberships where project_id=p.id;
delete from public.sensitive_events where project_id=p.id or (entity_type='project' and entity_id=p.id::text);
delete from public.projects where id=p.id;
perform private.hard_delete_end();
-- The one row that stays: who, when, what kind, which name. No content.
perform private.audit('project.deleted','project',p.id::text,null,null,jsonb_build_object('name',p.name,'counts',counts));
return jsonb_build_object('deleted',counts,'storage',queued);
exception when invalid_text_representation or check_violation or not_null_violation then perform private.fail('VALIDATION'); return null;
when foreign_key_violation then perform private.fail('CONFLICT','references'); return null;
end $$;

create function public.hard_delete_document(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.documents; f public.stored_files; queued jsonb;
begin
perform private.require_owner(); perform private.keys(input,array['id','confirmName']::text[],array['id','confirmName']::text[]);
select * into d from public.documents where id=(input->>'id')::uuid for update;
if not found then perform private.fail('NOT_FOUND'); end if;
if d.archived_at is null then perform private.fail('CONFLICT','not_deletable'); end if;
select * into f from public.stored_files where id=d.file_id for update;
if btrim(input->>'confirmName') is distinct from btrim(f.original_name) then perform private.fail('VALIDATION','confirmName'); end if;
queued:=private.queue_files(array[f.id]);
perform private.hard_delete_begin('document');
delete from public.document_grants where document_id=d.id;
update public.documents set replaces_document_id=null where replaces_document_id=d.id;
delete from public.documents where id=d.id;
delete from public.stored_files where id=f.id;
delete from public.sensitive_events where entity_type='document' and entity_id=d.id::text;
perform private.hard_delete_end();
perform private.audit('document.deleted','document',d.id::text,d.project_id,null,jsonb_build_object('name',f.original_name));
return jsonb_build_object('deleted',jsonb_build_object('files',1),'storage',queued);
exception when invalid_text_representation or check_violation or not_null_violation then perform private.fail('VALIDATION'); return null;
end $$;

create function public.hard_delete_entry(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.diary_entries; files uuid[]; queued jsonb; versions int; label text;
begin
perform private.require_owner(); perform private.keys(input,array['id','confirmName']::text[],array['id']::text[]);
select * into e from public.diary_entries where id=(input->>'id')::uuid for update;
if not found then perform private.fail('NOT_FOUND'); end if;
if e.cancelled_at is null then perform private.fail('CONFLICT','not_deletable'); end if;
label:=to_char(e.work_date,'DD/MM/YYYY');
select coalesce(array_agg(file_id),'{}'::uuid[]) into files from public.diary_attachments where entry_id=e.id;
if cardinality(files)>0 and btrim(input->>'confirmName') is distinct from label then perform private.fail('VALIDATION','confirmName'); end if;
select count(*) into versions from public.diary_versions where entry_id=e.id;
queued:=private.queue_files(files);
perform private.hard_delete_begin('entry');
delete from public.diary_version_files where entry_id=e.id;
delete from public.diary_attachments where entry_id=e.id;
delete from public.diary_versions where entry_id=e.id;
delete from public.diary_entries where id=e.id;
delete from public.stored_files where id=any(files);
delete from public.sensitive_events where entity_type='entry' and entity_id=e.id::text;
perform private.hard_delete_end();
perform private.audit('entry.deleted','entry',e.id::text,e.project_id,null,jsonb_build_object('name',label,'versions',versions,'files',cardinality(files)));
return jsonb_build_object('deleted',jsonb_build_object('versions',versions,'files',cardinality(files)),'storage',queued);
exception when invalid_text_representation or check_violation or not_null_violation then perform private.fail('VALIDATION'); return null;
end $$;

create function public.hard_delete_transaction(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.transactions;
begin
perform private.require_owner(); perform private.keys(input,array['id']::text[],array['id']::text[]);
select * into t from public.transactions where id=(input->>'id')::uuid for update;
if not found then perform private.fail('NOT_FOUND'); end if;
if t.cancelled_at is null then perform private.fail('CONFLICT','not_deletable'); end if;
perform private.hard_delete_begin('transaction');
delete from public.transactions where id=t.id;
delete from public.sensitive_events where entity_type='transaction' and entity_id=t.id::text;
perform private.hard_delete_end();
perform private.audit('transaction.deleted','transaction',t.id::text,t.project_id,null,'{}'::jsonb);
return jsonb_build_object('deleted',jsonb_build_object('transactions',1),'storage','[]'::jsonb);
exception when invalid_text_representation or check_violation or not_null_violation then perform private.fail('VALIDATION'); return null;
end $$;

-- Service only: the storage queue. The server lists what is waiting, removes the objects, then acknowledges.
create function public.system_storage_pending(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if input is null or jsonb_typeof(input)<>'object' then perform private.fail('VALIDATION'); end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'bucket',bucket,'path',path) order by id)
  from (select * from private.storage_deletions order by id limit 500) q),'[]'::jsonb);
end $$;
create function public.system_storage_done(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare n int;
begin
 if input is null or jsonb_typeof(input->'ids')<>'array' then perform private.fail('VALIDATION','ids'); end if;
 delete from private.storage_deletions where id in (select (x)::bigint from jsonb_array_elements_text(input->'ids') x);
 get diagnostics n=row_count;
 return jsonb_build_object('acknowledged',n);
exception when invalid_text_representation or numeric_value_out_of_range then perform private.fail('VALIDATION','ids'); return null;
end $$;

revoke all on function private.hard_delete_allows(text), private.hard_delete_begin(text), private.hard_delete_end(),
 private.queue_files(uuid[]), private.project_file_ids(uuid), private.project_has_moved_out_entries(uuid) from public,anon,authenticated,service_role;
revoke all on function public.hard_delete_preview(jsonb), public.hard_delete_project(jsonb), public.hard_delete_document(jsonb),
 public.hard_delete_entry(jsonb), public.hard_delete_transaction(jsonb), public.system_storage_pending(jsonb), public.system_storage_done(jsonb)
 from public,anon,authenticated,service_role;
grant execute on function public.hard_delete_preview(jsonb), public.hard_delete_project(jsonb), public.hard_delete_document(jsonb),
 public.hard_delete_entry(jsonb), public.hard_delete_transaction(jsonb) to authenticated;
grant execute on function public.system_storage_pending(jsonb), public.system_storage_done(jsonb) to service_role;
