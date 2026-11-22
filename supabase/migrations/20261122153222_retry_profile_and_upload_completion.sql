-- P1.2-FOLLOWUP: preparation only. Requires explicit D31 approval before cloud application.
begin;
-- No backfill: existing accounts must never acquire a creation retry receipt.
create table private.profile_creation_requests (
 actor_id uuid not null references public.profiles on delete restrict,
 request_id uuid not null,
 user_id uuid not null unique references public.profiles on delete restrict,
 email text not null, full_name text not null, completed boolean not null default false,
 primary key(actor_id,request_id)
);
alter table private.profile_creation_requests enable row level security;
revoke all on private.profile_creation_requests from public,anon,authenticated,service_role;

create or replace function public.create_profile(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.profiles; u auth.users; receipt private.profile_creation_requests;
begin
perform private.require_owner();
perform private.keys(input,array['requestId','email','fullName']::text[],array['requestId','email','fullName']::text[]);
perform private.request_lock('profile',(input->>'requestId')::uuid);
select * into receipt from private.profile_creation_requests where actor_id=auth.uid() and request_id=(input->>'requestId')::uuid;
if found then
 if receipt.email is distinct from lower(btrim(input->>'email')) or receipt.full_name is distinct from btrim(input->>'fullName') then perform private.fail('CONFLICT'); end if;
 select * into r from public.profiles where id=receipt.user_id for update;
 if not receipt.completed and (r.revision<>1 or not r.is_active or r.email is distinct from receipt.email or r.full_name is distinct from receipt.full_name or r.sessions_valid_after<>'-infinity'::timestamptz) then perform private.fail('CONFLICT'); end if;
 return private.saved(r.id,r.revision)||jsonb_build_object('passwordPending',not receipt.completed);
end if;
select * into u from auth.users where lower(email)=lower(btrim(input->>'email'));
if not found then perform private.fail('NOT_FOUND'); end if;
perform pg_advisory_xact_lock(hashtextextended(u.id::text,1));
if exists(select 1 from public.profiles where id=u.id) then perform private.fail('CONFLICT'); end if;
insert into public.profiles(id,email,full_name,created_by) values(u.id,lower(u.email),btrim(input->>'fullName'),auth.uid()) returning * into r;
insert into private.profile_creation_requests(actor_id,request_id,user_id,email,full_name)
 values(auth.uid(),(input->>'requestId')::uuid,r.id,r.email,r.full_name);
perform private.audit('user.created','profile',r.id::text);
return private.saved(r.id,r.revision)||jsonb_build_object('passwordPending',true);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.complete_profile_creation(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.profiles; receipt private.profile_creation_requests;
begin
perform private.require_owner();
perform private.keys(input,array['requestId','userId']::text[],array['requestId','userId']::text[]);
perform private.request_lock('profile',(input->>'requestId')::uuid);
select * into receipt from private.profile_creation_requests where actor_id=auth.uid() and request_id=(input->>'requestId')::uuid;
if not found then perform private.fail('NOT_FOUND'); end if;
if receipt.user_id is distinct from (input->>'userId')::uuid then perform private.fail('CONFLICT'); end if;
select * into r from public.profiles where id=receipt.user_id for update;
if receipt.completed then return private.saved(r.id,r.revision); end if;
if r.revision<>1 or not r.is_active or r.email is distinct from receipt.email or r.full_name is distinct from receipt.full_name or r.sessions_valid_after<>'-infinity'::timestamptz then perform private.fail('CONFLICT'); end if;
-- Called only after Auth password creation/update succeeds. Invalidate any earlier Auth sessions.
update public.profiles set sessions_valid_after=clock_timestamp(),revision=revision+1,updated_at=now() where id=r.id returning * into r;
update private.profile_creation_requests set completed=true where actor_id=auth.uid() and request_id=receipt.request_id;
return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create or replace function public.get_pending_upload(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.stored_files;
begin
perform private.require_active(); perform private.keys(input,array['fileId']::text[],array['fileId']::text[]);
select * into r from public.stored_files where id=(input->>'fileId')::uuid and uploaded_by=auth.uid();
if not found then perform private.fail('NOT_FOUND'); end if;
perform private.require_project(r.project_id,case when r.purpose='document' then 'manager' else 'member' end);
if r.purpose='cover' then perform private.require_owner(); end if;
if r.state<>'pending' and (exists(select 1 from public.documents where file_id=r.id)
 or exists(select 1 from public.project_covers where file_id=r.id)
 or exists(select 1 from public.diary_attachments where file_id=r.id)) then perform private.fail('NOT_FOUND'); end if;
return jsonb_build_object('fileId',r.id,'projectId',r.project_id,'uploadedBy',r.uploaded_by,'purpose',r.purpose,'bucket',r.bucket,'path',r.object_path,'name',r.original_name,'declaredMime',r.declared_mime,'declaredSize',r.declared_size,'state',r.state,'fileRef',case when r.state='ready' then jsonb_build_object('id',r.id,'name',r.original_name,'mime',r.mime,'sizeBytes',r.size_bytes,'displayState',r.display_state) else null end);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create or replace function public.system_finish_upload(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.stored_files; u public.profiles; allowed boolean;
begin
perform private.keys(input,array['fileId','actorId','sessionId','state','mime','sizeBytes','sha256','displayPath','displayState']::text[],array['fileId','actorId','sessionId','state']::text[]);
select * into r from public.stored_files where id=(input->>'fileId')::uuid for update;
if not found or r.uploaded_by<>(input->>'actorId')::uuid then perform private.fail('NOT_FOUND'); end if;
select * into u from public.profiles where id=r.uploaded_by for share;
if not u.is_active or not exists(select 1 from auth.sessions s where s.id=(input->>'sessionId')::uuid and s.user_id=u.id and s.created_at>=u.sessions_valid_after) then perform private.fail('UNAUTHENTICATED'); end if;
perform 1 from public.projects where id=r.project_id for share;
perform 1 from public.memberships where project_id=r.project_id and user_id=u.id for share;
allowed:=u.is_owner or (r.purpose<>'cover' and exists(select 1 from public.memberships m join public.projects p on p.id=m.project_id
where m.user_id=u.id and p.id=r.project_id and p.status='active' and p.archived_at is null and (r.purpose='diary' or m.role='manager')));
if not allowed then perform private.fail('FORBIDDEN'); end if;
if input->>'state' not in ('ready','rejected') then perform private.fail('VALIDATION'); end if;
if r.state<>'pending' and (exists(select 1 from public.documents where file_id=r.id)
 or exists(select 1 from public.project_covers where file_id=r.id)
 or exists(select 1 from public.diary_attachments where file_id=r.id)) then perform private.fail('NOT_FOUND'); end if;
if r.state<>'pending' then
 if r.state::text is distinct from input->>'state' or r.mime is distinct from input->>'mime'
 or r.size_bytes is distinct from (input->>'sizeBytes')::bigint or r.sha256 is distinct from input->>'sha256'
 or r.display_path is distinct from input->>'displayPath'
 or r.display_state is distinct from coalesce((input->>'displayState')::public.display_state,'none') then perform private.fail('CONFLICT'); end if;
 return jsonb_build_object('id',r.id,'name',r.original_name,'mime',r.mime,'sizeBytes',r.size_bytes,'displayState',r.display_state);
end if;
if input->>'state'='ready' then
 if input->>'mime' not in ('application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif') or (r.purpose='cover' and input->>'mime'='application/pdf') then perform private.fail('LIMIT'); end if;
 if input->>'mime' is distinct from r.declared_mime or (input->>'sizeBytes')::bigint is distinct from r.declared_size then perform private.fail('VALIDATION'); end if;
 if input->>'displayState'='ready' and input->>'displayPath' is distinct from r.project_id::text||'/'||r.id::text||'.jpg' then perform private.fail('VALIDATION'); end if;
end if;
update public.stored_files set state=(input->>'state')::public.file_state,mime=input->>'mime',size_bytes=(input->>'sizeBytes')::bigint,
sha256=input->>'sha256',display_path=input->>'displayPath',display_state=coalesce((input->>'displayState')::public.display_state,'none'),
ready_at=case when input->>'state'='ready' then now() else null end where id=r.id returning * into r;
return jsonb_build_object('id',r.id,'name',r.original_name,'mime',r.mime,'sizeBytes',r.size_bytes,'displayState',r.display_state);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

revoke all on function public.complete_profile_creation(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.complete_profile_creation(jsonb) to authenticated;
commit;
