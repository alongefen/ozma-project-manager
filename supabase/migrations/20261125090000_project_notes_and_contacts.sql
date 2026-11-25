-- CLIENT-FEEDBACK-B (A-45): project notes and extra contacts. Two NEW tables, nothing existing is changed.
-- Rollback: supabase/rollback/20261125090000_project_notes_and_contacts.down.sql (not a migration; never auto-applied).
-- Name note: public.project_contacts already exists (the one primary contact per project), so the new table is project_extra_contacts.
-- FKs to projects cascade (unlike the rest of the schema) so the owner's two-step hard delete (A-44) of a project needs no change to
-- its function. Nothing else ever deletes these rows: notes are cancelled, contacts are removed with deleted_at.
begin;

create table public.project_notes (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects on delete cascade,
 body text not null check(length(btrim(body)) between 1 and 5000),
 author_id uuid not null references public.profiles on delete restrict,
 author_name text not null,
 request_id uuid not null,
 created_at timestamptz not null default now(),
 edited_at timestamptz,
 cancelled_at timestamptz,
 revision int not null default 1 check(revision>0),
 unique(author_id,request_id)
);
create index project_notes_project on public.project_notes(project_id,created_at desc) where cancelled_at is null;

create table public.project_extra_contacts (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 120),
 role_title text check(length(role_title)<=120),
 phone text not null check(length(btrim(phone)) between 1 and 40),
 created_by uuid not null references public.profiles on delete restrict,
 request_id uuid not null,
 created_at timestamptz not null default now(),
 deleted_at timestamptz,
 revision int not null default 1 check(revision>0),
 unique(created_by,request_id)
);
create index project_extra_contacts_project on public.project_extra_contacts(project_id,created_at) where deleted_at is null;

alter table public.project_notes enable row level security;
alter table public.project_extra_contacts enable row level security;
create policy read_project_notes on public.project_notes for select to authenticated using (cancelled_at is null and (select private.member(project_id)));
create policy read_project_extra_contacts on public.project_extra_contacts for select to authenticated using (deleted_at is null and (select private.member(project_id)));
grant select on public.project_notes to authenticated;
grant select on public.project_extra_contacts to authenticated;

-- Notes: any member may write on a writable project (owner always). Edit/cancel: the author or an owner-level account.
create function public.create_project_note(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.project_notes; n text;
begin
perform private.require_active(); perform private.keys(input,array['requestId','projectId','body']::text[],array['requestId','projectId','body']::text[]);
perform private.require_project((input->>'projectId')::uuid,'member'); perform private.request_lock('project_note',(input->>'requestId')::uuid);
select * into r from public.project_notes where author_id=auth.uid() and request_id=(input->>'requestId')::uuid;
if found then perform private.require_project(r.project_id,'member'); return private.saved(r.id,r.revision); end if;
select full_name into n from public.profiles where id=auth.uid();
insert into public.project_notes(project_id,body,author_id,author_name,request_id) values((input->>'projectId')::uuid,btrim(input->>'body'),auth.uid(),coalesce(n,''),(input->>'requestId')::uuid) returning * into r;
return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation then perform private.fail('VALIDATION'); return null;
end $$;

create function public.update_project_note(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.project_notes;
begin
perform private.require_active(); perform private.keys(input,array['id','expectedRevision','body']::text[],array['id','expectedRevision','body']::text[]);
select * into r from public.project_notes where id=(input->>'id')::uuid and cancelled_at is null for update; if not found then perform private.fail('NOT_FOUND'); end if;
perform private.require_project(r.project_id,'member');
if r.author_id<>auth.uid() and not private.owner() then perform private.fail('FORBIDDEN'); end if;
perform private.revision(r.revision,input->'expectedRevision');
update public.project_notes set body=btrim(input->>'body'),edited_at=now(),revision=revision+1 where id=r.id returning * into r;
return private.saved(r.id,r.revision);
exception when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation then perform private.fail('VALIDATION'); return null;
end $$;

create function public.cancel_project_note(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.project_notes;
begin
perform private.require_active(); perform private.keys(input,array['id','expectedRevision']::text[],array['id','expectedRevision']::text[]);
select * into r from public.project_notes where id=(input->>'id')::uuid and cancelled_at is null for update; if not found then perform private.fail('NOT_FOUND'); end if;
perform private.require_project(r.project_id,'member');
if r.author_id<>auth.uid() and not private.owner() then perform private.fail('FORBIDDEN'); end if;
perform private.revision(r.revision,input->'expectedRevision');
update public.project_notes set cancelled_at=now(),revision=revision+1 where id=r.id returning * into r;
return private.saved(r.id,r.revision);
exception when invalid_text_representation then perform private.fail('VALIDATION'); return null;
end $$;

-- Extra contacts: managers of the project and owner-level accounts (permission 'manager'); workers only read.
create function public.create_project_contact(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.project_extra_contacts;
begin
perform private.require_active(); perform private.keys(input,array['requestId','projectId','name','roleTitle','phone']::text[],array['requestId','projectId','name','roleTitle','phone']::text[]);
perform private.require_project((input->>'projectId')::uuid,'manager'); perform private.request_lock('project_contact',(input->>'requestId')::uuid);
select * into r from public.project_extra_contacts where created_by=auth.uid() and request_id=(input->>'requestId')::uuid;
if found then perform private.require_project(r.project_id,'manager'); return private.saved(r.id,r.revision); end if;
insert into public.project_extra_contacts(project_id,name,role_title,phone,created_by,request_id) values((input->>'projectId')::uuid,btrim(input->>'name'),nullif(btrim(input->>'roleTitle'),''),btrim(input->>'phone'),auth.uid(),(input->>'requestId')::uuid) returning * into r;
return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation then perform private.fail('VALIDATION'); return null;
end $$;

create function public.update_project_contact(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.project_extra_contacts;
begin
perform private.require_active(); perform private.keys(input,array['id','expectedRevision','name','roleTitle','phone']::text[],array['id','expectedRevision','name','roleTitle','phone']::text[]);
select * into r from public.project_extra_contacts where id=(input->>'id')::uuid and deleted_at is null for update; if not found then perform private.fail('NOT_FOUND'); end if;
perform private.require_project(r.project_id,'manager'); perform private.revision(r.revision,input->'expectedRevision');
update public.project_extra_contacts set name=btrim(input->>'name'),role_title=nullif(btrim(input->>'roleTitle'),''),phone=btrim(input->>'phone'),revision=revision+1 where id=r.id returning * into r;
return private.saved(r.id,r.revision);
exception when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation then perform private.fail('VALIDATION'); return null;
end $$;

create function public.remove_project_contact(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.project_extra_contacts;
begin
perform private.require_active(); perform private.keys(input,array['id','expectedRevision']::text[],array['id','expectedRevision']::text[]);
select * into r from public.project_extra_contacts where id=(input->>'id')::uuid and deleted_at is null for update; if not found then perform private.fail('NOT_FOUND'); end if;
perform private.require_project(r.project_id,'manager'); perform private.revision(r.revision,input->'expectedRevision');
update public.project_extra_contacts set deleted_at=now(),revision=revision+1 where id=r.id returning * into r;
return private.saved(r.id,r.revision);
exception when invalid_text_representation then perform private.fail('VALIDATION'); return null;
end $$;

grant execute on function public.create_project_note(jsonb) to authenticated;
grant execute on function public.update_project_note(jsonb) to authenticated;
grant execute on function public.cancel_project_note(jsonb) to authenticated;
grant execute on function public.create_project_contact(jsonb) to authenticated;
grant execute on function public.update_project_contact(jsonb) to authenticated;
grant execute on function public.remove_project_contact(jsonb) to authenticated;
commit;
