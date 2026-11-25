-- CLIENT-FEEDBACK-C (A-46): optional task assignee. Reverses the earlier "no assignee" cut (TASK-05) at the client's request.
-- What: one nullable column public.tasks.assignee_id, one helper private.check_assignee, and create or replace of create_task / update_task.
-- assigneeId is optional in both functions: omitted = unchanged (update) / none (create); '' = none (clears it). private.keys is NOT changed
-- (it rejects JSON null for this key), hence the empty string. A non-empty value must be an active profile holding a membership on the SAME project.
-- Finished/archived projects stay read-only (require_project is unchanged). Reads stay RLS (read_tasks). Cost: none.
-- Rollback: supabase/rollback/20261125120000_task_assignee.down.sql (not a migration; never auto-applied).
begin;
alter table public.tasks add column assignee_id uuid references public.profiles on delete restrict;
create index tasks_assignee on public.tasks(assignee_id) where deleted_at is null and assignee_id is not null;
create function private.check_assignee(p uuid, a text) returns void language plpgsql security definer set search_path='' as $$
begin
 if a is null or a='' then return; end if;
 if a !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then perform private.fail('VALIDATION','assigneeId'); end if;
 if not exists(select 1 from public.memberships m join public.profiles pr on pr.id=m.user_id where m.project_id=p and m.user_id=a::uuid and pr.is_active) then
  perform private.fail('VALIDATION','assigneeId');
 end if;
end $$;
grant execute on function private.check_assignee(uuid,text) to authenticated;

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

commit;
