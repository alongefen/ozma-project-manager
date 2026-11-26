-- PROPOSAL ONLY. D31 approval required before application to the shared live DB.
-- No existing business objects/rows, auth users, audit constraints or services are changed.
begin;
create function private.lead_phone(value text) returns text language sql immutable set search_path='' as $$
 select case when compact ~ '^(\+972|00972)0?[0-9]+$' then regexp_replace(compact,'^(\+972|00972)0?','0') else compact end
 from (select regexp_replace(btrim(value),'[[:space:]().-]','','g') compact) normalized
$$;
revoke all on function private.lead_phone(text) from public,anon,authenticated,service_role;

create table public.leads (
 id uuid primary key default gen_random_uuid(),
 revision integer not null default 1 check (revision > 0),
 created_by uuid not null references public.profiles(id) on delete restrict,
 request_id uuid not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 archived_at timestamptz, deleted_at timestamptz,
 canonical_phone text not null check (length(canonical_phone)>0),
 name text not null check (length(btrim(name)) between 1 and 200),
 phone text not null check (length(btrim(phone)) between 1 and 80),
 email text check (length(btrim(email)) between 1 and 254),
 company_name text check (length(btrim(company_name)) between 1 and 200),
 business_type text check (length(btrim(business_type)) between 1 and 200),
 project_budget text check (length(btrim(project_budget)) between 1 and 500),
 has_designer text not null check (has_designer=any(array['yes','no','unknown']::text[])),
 has_plan_set text not null check (has_plan_set=any(array['yes','no','unknown']::text[])),
 source text not null check (source=any(array['facebook','instagram','google_sheets','manual']::text[])),
 marketing_company text check (marketing_company=any(array['new_company','previous_company']::text[])),
 inquiry_date date not null check (inquiry_date between date '0001-01-01' and date '9999-12-31'),
 status text not null check (status=any(array['new','called','qualified','proposal_sent','won','irrelevant','denies_inquiry','no_answer']::text[])),
 follow_up_date date check (follow_up_date between date '0001-01-01' and date '9999-12-31'),
 notes text check (length(btrim(notes)) between 1 and 10000),
 unique(created_by,request_id)
);
create index leads_phone_live on public.leads(canonical_phone) where deleted_at is null;
create index leads_order_live on public.leads(inquiry_date desc,id desc) where deleted_at is null;
alter table public.leads enable row level security;
revoke all on table public.leads from public,anon,authenticated,service_role;
grant select on table public.leads to authenticated;
create policy leads_owner_select on public.leads for select to authenticated
 using ((select private.owner()) and deleted_at is null);

-- Dedicated validation: does not expand/change private.keys or any existing RPC.
create function private.lead_keys(input jsonb,allowed text[],required text[]) returns void language plpgsql set search_path='' as $$
begin
 if input is null or jsonb_typeof(input)<>'object' then perform private.fail('VALIDATION'); end if;
 if not input ?& required or exists(select 1 from jsonb_object_keys(input) as keys(key_name) where not keys.key_name=any(allowed)) then perform private.fail('VALIDATION'); end if;
end $$;
create function private.lead_fields(input jsonb) returns jsonb language plpgsql set search_path='' as $$
declare f jsonb; k text; v jsonb; d date;
begin
 perform private.lead_keys(input,array['name','phone','email','companyName','businessType','projectBudget','hasDesigner','hasPlanSet','source','marketingCompany','inquiryDate','status','followUpDate','notes']::text[],array['name','phone','inquiryDate']::text[]);
 f := '{"email":null,"companyName":null,"businessType":null,"projectBudget":null,"hasDesigner":"unknown","hasPlanSet":"unknown","source":"manual","marketingCompany":null,"status":"new","followUpDate":null,"notes":null}'::jsonb || input;
 for k,v in select key,value from jsonb_each(f) loop
  if v='null'::jsonb then
   if not k=any(array['email','companyName','businessType','projectBudget','marketingCompany','followUpDate','notes']::text[]) then perform private.fail('VALIDATION',k); end if;
   continue;
  end if;
  if jsonb_typeof(v)<>'string' then perform private.fail('VALIDATION',k); end if;
  -- Email is not trimmed by LeadFieldsSchema; reject surrounding whitespace too.
  if k='email' then continue; end if;
  f:=jsonb_set(f,array[k],to_jsonb(regexp_replace(v #>> '{}','^[[:space:]]+|[[:space:]]+$','','g')));
 end loop;
 if f->'name'<>'null'::jsonb and length(f->>'name') not between 1 and 200 then perform private.fail('VALIDATION','name'); end if;
 if f->'phone'<>'null'::jsonb and length(f->>'phone') not between 1 and 80 then perform private.fail('VALIDATION','phone'); end if;
 if f->'email'<>'null'::jsonb and length(f->>'email') not between 1 and 254 then perform private.fail('VALIDATION','email'); end if;
 if f->'companyName'<>'null'::jsonb and length(f->>'companyName') not between 1 and 200 then perform private.fail('VALIDATION','companyName'); end if;
 if f->'businessType'<>'null'::jsonb and length(f->>'businessType') not between 1 and 200 then perform private.fail('VALIDATION','businessType'); end if;
 if f->'projectBudget'<>'null'::jsonb and length(f->>'projectBudget') not between 1 and 500 then perform private.fail('VALIDATION','projectBudget'); end if;
 if f->'hasDesigner'<>'null'::jsonb and not (f->>'hasDesigner')=any(array['yes','no','unknown']::text[]) then perform private.fail('VALIDATION','hasDesigner'); end if;
 if f->'hasPlanSet'<>'null'::jsonb and not (f->>'hasPlanSet')=any(array['yes','no','unknown']::text[]) then perform private.fail('VALIDATION','hasPlanSet'); end if;
 if f->'source'<>'null'::jsonb and not (f->>'source')=any(array['facebook','instagram','google_sheets','manual']::text[]) then perform private.fail('VALIDATION','source'); end if;
 if f->'marketingCompany'<>'null'::jsonb and not (f->>'marketingCompany')=any(array['new_company','previous_company']::text[]) then perform private.fail('VALIDATION','marketingCompany'); end if;
 if f->'status'<>'null'::jsonb and not (f->>'status')=any(array['new','called','qualified','proposal_sent','won','irrelevant','denies_inquiry','no_answer']::text[]) then perform private.fail('VALIDATION','status'); end if;
 if f->'notes'<>'null'::jsonb and length(f->>'notes') not between 1 and 10000 then perform private.fail('VALIDATION','notes'); end if;
 -- Pinned Zod 4.6.7 email pattern; C collation keeps ASCII ranges locale-independent.
 if f->'email'<>'null'::jsonb and (f->>'email') collate "C" !~ '^(?:[A-Za-z0-9_''+\-]+\.)*[A-Za-z0-9_''+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$' then perform private.fail('VALIDATION','email'); end if;
 foreach k in array array['inquiryDate','followUpDate'] loop
  if f->k<>'null'::jsonb then
   if f->>k !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then perform private.fail('VALIDATION',k); end if;
   d:=(f->>k)::date;
   if to_char(d,'YYYY-MM-DD')<>f->>k or d not between date '0001-01-01' and date '9999-12-31' then perform private.fail('VALIDATION',k); end if;
  end if;
 end loop;
 return f;
end $$;
revoke all on function private.lead_keys(jsonb,text[],text[]),private.lead_fields(jsonb) from public,anon,authenticated,service_role;

create function public.create_lead(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.leads; f jsonb; phone_key text; duplicates integer; request uuid; override boolean;
begin
 perform private.require_owner();
 perform private.lead_keys(input,array['name','phone','email','companyName','businessType','projectBudget','hasDesigner','hasPlanSet','source','marketingCompany','inquiryDate','status','followUpDate','notes','requestId','allowDuplicate']::text[],array['name','phone','inquiryDate','requestId']::text[]);
 if jsonb_typeof(input->'requestId') is distinct from 'string' then perform private.fail('VALIDATION','requestId'); end if;
 request:=(input->>'requestId')::uuid;
 if input ? 'allowDuplicate' and jsonb_typeof(input->'allowDuplicate') is distinct from 'boolean' then perform private.fail('VALIDATION','allowDuplicate'); end if;
 override:=coalesce((input->>'allowDuplicate')::boolean,false);
 f:=private.lead_fields(input-'requestId'-'allowDuplicate');
 -- Serialize creation and phone edits for the small global register; no locks on existing business tables.
 perform pg_advisory_xact_lock(190049,1);
 select * into r from public.leads where created_by=auth.uid() and request_id=request;
 if found then
  if r.deleted_at is not null then perform private.fail('NOT_FOUND'); end if;
  return jsonb_build_object('kind','saved','saved',private.saved(r.id,r.revision));
 end if;
 phone_key:=private.lead_phone(f->>'phone');
 select count(*) into duplicates from public.leads where canonical_phone=phone_key and deleted_at is null;
 if duplicates>0 and not override then return jsonb_build_object('kind','duplicate','duplicateCount',duplicates); end if;
 insert into public.leads(created_by,request_id,canonical_phone,name,phone,email,company_name,business_type,project_budget,has_designer,has_plan_set,source,marketing_company,inquiry_date,status,follow_up_date,notes)
 values(auth.uid(),request,phone_key,f->>'name',f->>'phone',f->>'email',f->>'companyName',f->>'businessType',f->>'projectBudget',f->>'hasDesigner',f->>'hasPlanSet',f->>'source',f->>'marketingCompany',(f->>'inquiryDate')::date,f->>'status',(f->>'followUpDate')::date,f->>'notes') returning * into r;
 return jsonb_build_object('kind','saved','saved',private.saved(r.id,r.revision));
exception when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

-- One private implementation, four narrowly shaped public write endpoints.
create function private.mutate_lead(operation text,input jsonb) returns jsonb language plpgsql set search_path='' as $$
declare r public.leads; f jsonb; extra text;
begin
 perform private.require_owner();
 extra:=case operation when 'update' then 'fields' when 'status' then 'status' when 'archive' then 'archived' else null end;
 perform private.lead_keys(input, array['id','expectedRevision']::text[] || case when extra is null then '{}'::text[] else array[extra] end,
  array['id','expectedRevision']::text[] || case when extra is null then '{}'::text[] else array[extra] end);
 if jsonb_typeof(input->'id') is distinct from 'string' then perform private.fail('VALIDATION','id'); end if;
 -- Same lock order as create, so edits cannot race its phone check.
 perform pg_advisory_xact_lock(190049,1);
 select * into r from public.leads where id=(input->>'id')::uuid and deleted_at is null for update;
 if not found then perform private.fail('NOT_FOUND'); end if;
 perform private.revision(r.revision,input->'expectedRevision');
 if operation='update' then
  f:=private.lead_fields(input->'fields');
  update public.leads set name=f->>'name',phone=f->>'phone',email=f->>'email',company_name=f->>'companyName',business_type=f->>'businessType',project_budget=f->>'projectBudget',has_designer=f->>'hasDesigner',has_plan_set=f->>'hasPlanSet',source=f->>'source',marketing_company=f->>'marketingCompany',inquiry_date=(f->>'inquiryDate')::date,status=f->>'status',follow_up_date=(f->>'followUpDate')::date,notes=f->>'notes',canonical_phone=private.lead_phone(f->>'phone') where id=r.id;
 elsif operation='status' then
  if jsonb_typeof(input->'status') is distinct from 'string' or not (input->>'status')=any(array['new','called','qualified','proposal_sent','won','irrelevant','denies_inquiry','no_answer']::text[]) then perform private.fail('VALIDATION','status'); end if;
  update public.leads set status=input->>'status' where id=r.id;
 elsif operation='archive' then
  if jsonb_typeof(input->'archived') is distinct from 'boolean' then perform private.fail('VALIDATION','archived'); end if;
  update public.leads set archived_at=case when (input->>'archived')::boolean then coalesce(archived_at,now()) else null end where id=r.id;
 elsif operation='delete' then
  update public.leads set deleted_at=now() where id=r.id;
 else perform private.fail('VALIDATION');
 end if;
 update public.leads set revision=revision+1,updated_at=now() where id=r.id returning * into r;
 return private.saved(r.id,r.revision);
exception when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;
revoke all on function private.mutate_lead(text,jsonb) from public,anon,authenticated,service_role;
create function public.update_lead(input jsonb) returns jsonb language sql security definer set search_path='' as $$
 select private.mutate_lead('update',input)
$$;
create function public.set_lead_status(input jsonb) returns jsonb language sql security definer set search_path='' as $$
 select private.mutate_lead('status',input)
$$;
create function public.set_lead_archived(input jsonb) returns jsonb language sql security definer set search_path='' as $$
 select private.mutate_lead('archive',input)
$$;
create function public.delete_lead(input jsonb) returns jsonb language sql security definer set search_path='' as $$
 select private.mutate_lead('delete',input)
$$;
revoke all on function public.create_lead(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.create_lead(jsonb) to authenticated;
revoke all on function public.update_lead(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.update_lead(jsonb) to authenticated;
revoke all on function public.set_lead_status(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.set_lead_status(jsonb) to authenticated;
revoke all on function public.set_lead_archived(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.set_lead_archived(jsonb) to authenticated;
revoke all on function public.delete_lead(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.delete_lead(jsonb) to authenticated;
commit;
