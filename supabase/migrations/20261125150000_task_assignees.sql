-- CLIENT-FEEDBACK-C (A-47): several optional assignees per task, and the assignee picker shows every active member AND every active
-- owner-level account (owners hold no membership row but act on all projects).
-- What: NEW table public.task_assignees (task_id, user_id, project_id) with RLS read like tasks and a backfill from tasks.assignee_id;
-- NEW helper private.check_assignees; create or replace of create_task / update_task; replace of public.list_project_assignees
-- (now also returns is_owner and the active owner-level accounts). Nothing is dropped or altered in existing tables: tasks.assignee_id stays
-- and is kept in sync with the first assignee, so the previous bodies keep working after a rollback.
-- Compatibility: the functions accept the new key `userIds` (an array; private.keys already knows this name as an array) AND the old
-- `assigneeId`, so the app version running before this deploy keeps working. Omitted = unchanged on update; [] (or '') = none.
-- Each id must be an ACTIVE profile that is either an owner-level account or holds a membership on the SAME project, else VALIDATION.
-- Finished/archived projects stay read-only (require_project unchanged). FK task_id cascades so the owner hard delete of a project (A-44)
-- needs no change. Cost: none. Rollback: supabase/rollback/20261125150000_task_assignees.down.sql (not a migration; never auto-applied).
begin;

create table public.task_assignees (
 task_id uuid not null references public.tasks on delete cascade,
 user_id uuid not null references public.profiles on delete restrict,
 project_id uuid not null references public.projects on delete cascade,
 created_at timestamptz not null default now(),
 primary key (task_id, user_id)
);
create index task_assignees_user on public.task_assignees(user_id, project_id);
create index task_assignees_project on public.task_assignees(project_id);
alter table public.task_assignees enable row level security;
create policy read_task_assignees on public.task_assignees for select to authenticated
 using ((select private.member(project_id)) and exists(select 1 from public.tasks t where t.id=task_id and t.deleted_at is null));
revoke all on public.task_assignees from public, anon, authenticated;
grant select on public.task_assignees to authenticated;

insert into public.task_assignees(task_id,user_id,project_id)
 select t.id,t.assignee_id,t.project_id from public.tasks t where t.assignee_id is not null on conflict do nothing;

create function private.check_assignees(p uuid, ids uuid[]) returns void language plpgsql security definer set search_path='' as $$
begin
 if ids is null or cardinality(ids)=0 then return; end if;
 if cardinality(ids)>50 then perform private.fail('VALIDATION','userIds'); end if;
 if (select count(*) from public.profiles pr where pr.id=any(ids) and pr.is_active
      and (pr.is_owner or exists(select 1 from public.memberships m where m.project_id=p and m.user_id=pr.id)))
    <> (select count(distinct x) from unnest(ids) x) then
  perform private.fail('VALIDATION','userIds');
 end if;
end $$;
grant execute on function private.check_assignees(uuid,uuid[]) to authenticated;

-- Reads the optional list out of the input: userIds (array) wins; else the legacy assigneeId; null = key absent (unchanged).
create function private.assignee_ids(input jsonb) returns uuid[] language plpgsql immutable set search_path='' as $$
declare r uuid[];
begin
 if input ? 'userIds' then
  if exists(select 1 from jsonb_array_elements(input->'userIds') e where jsonb_typeof(e)<>'string') then perform private.fail('VALIDATION','userIds'); end if;
  select coalesce(array_agg(distinct (e #>> '{}')::uuid),'{}') into r from jsonb_array_elements(input->'userIds') e;
  return r;
 elsif input ? 'assigneeId' then
  if coalesce(input->>'assigneeId','')='' then return '{}'; end if;
  return array[(input->>'assigneeId')::uuid];
 end if;
 return null;
end $$;
grant execute on function private.assignee_ids(jsonb) to authenticated;

create or replace function public.create_task(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.tasks; ids uuid[];
begin
perform private.require_active(); perform private.keys(input,array['requestId','projectId','body','dueDate','completed','assigneeId','userIds']::text[],array['requestId','projectId','body','dueDate','completed']::text[]);
perform private.require_project((input->>'projectId')::uuid,'member'); ids:=private.assignee_ids(input); perform private.check_assignees((input->>'projectId')::uuid,ids); perform private.request_lock('task',(input->>'requestId')::uuid); select * into r from public.tasks where created_by=auth.uid() and request_id=(input->>'requestId')::uuid; if found then perform private.require_project(r.project_id,'member'); return private.saved(r.id,r.revision); end if;
 insert into public.tasks(project_id,body,due_date,completed,created_by,request_id,assignee_id) values((input->>'projectId')::uuid,btrim(input->>'body'),(input->>'dueDate')::date,(input->>'completed')::boolean,auth.uid(),(input->>'requestId')::uuid,coalesce(ids,'{}')[1]) returning * into r;
 insert into public.task_assignees(task_id,user_id,project_id) select r.id,x,r.project_id from unnest(coalesce(ids,'{}')) x;
return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create or replace function public.update_task(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.tasks; ids uuid[];
begin
perform private.require_active(); perform private.keys(input,array['id','expectedRevision','body','dueDate','assigneeId','userIds']::text[],array['id','expectedRevision','body','dueDate']::text[]);
select * into r from public.tasks where id=(input->>'id')::uuid and deleted_at is null for update; if not found then perform private.fail('NOT_FOUND'); end if; perform private.require_project(r.project_id,'member'); perform private.revision(r.revision,input->'expectedRevision');
ids:=private.assignee_ids(input);
if ids is not null then
 perform private.check_assignees(r.project_id,ids);
 delete from public.task_assignees where task_id=r.id and not (user_id=any(ids));
 insert into public.task_assignees(task_id,user_id,project_id) select r.id,x,r.project_id from unnest(ids) x on conflict do nothing;
end if;
update public.tasks set body=btrim(input->>'body'),due_date=(input->>'dueDate')::date,assignee_id=case when ids is not null then ids[1] else assignee_id end,revision=revision+1,updated_at=now() where id=r.id returning * into r;
return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

drop function public.list_project_assignees(uuid);
create function public.list_project_assignees(p uuid) returns table(user_id uuid, full_name text, role public.project_role, is_owner boolean)
 language sql stable security definer set search_path='' as $$
 select pr.id, pr.full_name, m.role, pr.is_owner
 from public.profiles pr left join public.memberships m on m.user_id=pr.id and m.project_id=p
 where pr.is_active and (pr.is_owner or m.user_id is not null) and private.member(p)
 order by pr.is_owner desc, pr.full_name, pr.id
$$;
revoke all on function public.list_project_assignees(uuid) from public, anon;
grant execute on function public.list_project_assignees(uuid) to authenticated;

commit;
