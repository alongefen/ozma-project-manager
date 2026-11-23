-- P1.4.10: update_project keeps project_private.business_number when the owner omits the optional field.
-- Explicit null still clears it; a value replaces it. Only this function changes. Rollback: re-create the previous body (docs/tasks/P1.4.10.md).
create or replace function public.update_project(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.projects; f jsonb;
begin
perform private.require_active(); perform private.keys(input,array['id','expectedRevision','fields']::text[],array['id','expectedRevision','fields']::text[]);
select * into r from public.projects where id=(input->>'id')::uuid for update; if not found then perform private.fail('NOT_FOUND'); end if; perform private.require_project(r.id,'manager'); perform private.revision(r.revision,input->'expectedRevision');
f:=input->'fields'; perform private.keys(f,array['name', 'businessName', 'siteAddress', 'contact', 'startDate', 'endDate', 'accessNotes', 'businessNumber']::text[],array['name', 'businessName', 'siteAddress', 'contact', 'startDate', 'endDate', 'accessNotes']::text[]);
perform private.keys(f->'contact',array['name','phone','email','roleTitle'],array['name','phone','email','roleTitle']); if f ? 'businessNumber' and not private.owner() then perform private.fail('FORBIDDEN'); end if;
update public.projects set name=btrim(f->>'name'),business_name=btrim(f->>'businessName'),site_address=btrim(f->>'siteAddress'),access_notes=f->>'accessNotes',start_date=(f->>'startDate')::date,end_date=(f->>'endDate')::date,revision=revision+1,updated_at=now() where id=r.id returning * into r;
insert into public.project_contacts(project_id,name,phone,email,role_title) values(r.id,btrim(f->'contact'->>'name'),btrim(f->'contact'->>'phone'),f->'contact'->>'email',f->'contact'->>'roleTitle')
 on conflict(project_id) do update set name=excluded.name,phone=excluded.phone,email=excluded.email,role_title=excluded.role_title;
 if private.owner() then
  if f ? 'businessNumber' then insert into public.project_private(project_id,business_number) values(r.id,f->>'businessNumber') on conflict(project_id) do update set business_number=excluded.business_number;
  else insert into public.project_private(project_id,business_number) values(r.id,null) on conflict(project_id) do nothing; end if;
 end if;
perform private.audit('project.updated','project',r.id::text,r.id,null,jsonb_build_object('fields',(select jsonb_agg(k) from jsonb_object_keys(f) k))); return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;
