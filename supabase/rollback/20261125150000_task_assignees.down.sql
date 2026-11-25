-- Rollback for 20261125150000_task_assignees.sql. NOT a migration: run by hand, only after Alon's yes.
-- Restores the previous bodies of create_task / update_task (single assignee, from 20261125120000) and of list_project_assignees
-- (members only, from 20261125130000), then drops the new helpers and the task_assignees table (all multi-assignee rows are lost;
-- tasks.assignee_id kept the FIRST assignee of each task, so the single-assignee view stays sensible). No backup exists (Free plan).
begin;
create or replace function public.create_task(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.tasks;
begin
perform private.require_active(); perform private.keys(input,array['requestId','projectId','body','dueDate','completed','assigneeId']::text[],array['requestId','projectId','body','dueDate','completed']::text[]);
perform private.require_project((input->>'projectId')::uuid,'member'); perform private.check_assignee((input->>'projectId')::uuid,input->>'assigneeId'); perform private.request_lock('task',(input->>'requestId')::uuid); select * into r from public.tasks where created_by=auth.uid() and request_id=(input->>'requestId')::uuid; if found then perform private.require_project(r.project_id,'member'); return private.saved(r.id,r.revision); end if;
 insert into public.tasks(project_id,body,due_date,completed,created_by,request_id,assignee_id) values((input->>'projectId')::uuid,btrim(input->>'body'),(input->>'dueDate')::date,(input->>'completed')::boolean,auth.uid(),(input->>'requestId')::uuid,nullif(input->>'assigneeId','')::uuid) returning * into r;
return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create or replace function public.update_task(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.tasks;
begin
perform private.require_active(); perform private.keys(input,array['id','expectedRevision','body','dueDate','assigneeId']::text[],array['id','expectedRevision','body','dueDate']::text[]);
select * into r from public.tasks where id=(input->>'id')::uuid and deleted_at is null for update; if not found then perform private.fail('NOT_FOUND'); end if; perform private.require_project(r.project_id,'member'); perform private.revision(r.revision,input->'expectedRevision');
if input ? 'assigneeId' then perform private.check_assignee(r.project_id,input->>'assigneeId'); end if;
update public.tasks set body=btrim(input->>'body'),due_date=(input->>'dueDate')::date,assignee_id=case when input ? 'assigneeId' then nullif(input->>'assigneeId','')::uuid else assignee_id end,revision=revision+1,updated_at=now() where id=r.id returning * into r;
return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

drop function public.list_project_assignees(uuid);
create function public.list_project_assignees(p uuid) returns table(user_id uuid, full_name text, role public.project_role)
 language sql stable security definer set search_path='' as $$
 select m.user_id, pr.full_name, m.role
 from public.memberships m join public.profiles pr on pr.id=m.user_id
 where m.project_id=p and pr.is_active and private.member(p)
 order by pr.full_name, m.user_id
$$;
revoke all on function public.list_project_assignees(uuid) from public, anon;
grant execute on function public.list_project_assignees(uuid) to authenticated;
drop function private.assignee_ids(jsonb);
drop function private.check_assignees(uuid,uuid[]);
drop table public.task_assignees;
commit;
