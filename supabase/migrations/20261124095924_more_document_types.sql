-- More document types: Word (doc, docx), Excel (xls, xlsx), PowerPoint (ppt, pptx), for project documents only.
-- Diary attachments and project covers keep PDF/images only. Macro-enabled formats are not accepted; the server also
-- verifies the file content (ZIP/OLE structure) before a file becomes ready.
-- Rollback: re-run the two function definitions from 20261122143622_initial_project_database.sql (begin_upload) and
-- 20261122153222_retry_profile_and_upload_completion.sql (system_finish_upload); stored Office rows would then fail
-- to complete but nothing else depends on them. Grants are unchanged (create or replace keeps them).
begin;

create or replace function public.begin_upload(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p uuid; f jsonb; r public.stored_files; result jsonb:='[]'; purpose public.file_purpose;
begin

perform private.require_active(); perform private.keys(input,array['projectId','purpose','files']::text[],array['projectId','purpose','files']::text[]);
p:=(input->>'projectId')::uuid; purpose:=(input->>'purpose')::public.file_purpose;
if purpose='cover' then perform private.require_owner(); end if;
perform private.require_project(p,case when purpose='document' then 'manager' else 'member' end);
if jsonb_typeof(input->'files') is distinct from 'array' or jsonb_array_length(input->'files') not between 1 and 20 then perform private.fail('LIMIT','files'); end if;
for f in select value from jsonb_array_elements(input->'files') loop
 perform private.keys(f,array['clientId','name','mime','sizeBytes'],array['clientId','name','mime','sizeBytes']);
 if f->>'mime' not in ('application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation') or (purpose='cover' and f->>'mime'='application/pdf') or (purpose<>'document' and f->>'mime' in ('application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation')) then perform private.fail('LIMIT','mime'); end if;
 if (f->>'sizeBytes')::bigint not between 1 and (case when purpose='document' then 52428800 else 26214400 end) then perform private.fail('LIMIT','sizeBytes'); end if;
 r.id:=gen_random_uuid();
 insert into public.stored_files(id,purpose,project_id,uploaded_by,original_name,bucket,object_path,declared_mime,declared_size)
 values(r.id,purpose,p,auth.uid(),f->>'name','originals',p::text||'/'||r.id::text,f->>'mime',(f->>'sizeBytes')::bigint) returning * into r;
 result:=result||jsonb_build_array(jsonb_build_object('clientId',(f->>'clientId')::uuid,'fileId',r.id,'bucket',r.bucket,'path',r.object_path));
end loop;
return result;
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
 if input->>'mime' not in ('application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation') or (r.purpose='cover' and input->>'mime'='application/pdf') or (r.purpose<>'document' and input->>'mime' in ('application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation')) then perform private.fail('LIMIT'); end if;
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

commit;
