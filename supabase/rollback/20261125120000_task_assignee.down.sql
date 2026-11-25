-- Rollback for 20261125120000_task_assignee.sql. NOT a migration: run by hand, only after Alon's yes.
-- Destroys every stored assignee (no backup exists on the Free plan). Restores the previous function bodies (initial migration).
begin;
create or replace function public.create_task(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.tasks;
begin
perform private.require_active(); perform private.keys(input,array['requestId','projectId','body','dueDate','completed']::text[],array['requestId','projectId','body','dueDate','completed']::text[]);
perform private.require_project((input->>'projectId')::uuid,'member'); perform private.request_lock('task',(input->>'requestId')::uuid); select * into r from public.tasks where created_by=auth.uid() and request_id=(input->>'requestId')::uuid; if found then perform private.require_project(r.project_id,'member'); return private.saved(r.id,r.revision); end if;
 insert into public.tasks(project_id,body,due_date,completed,created_by,request_id) values((input->>'projectId')::uuid,btrim(input->>'body'),(input->>'dueDate')::date,(input->>'completed')::boolean,auth.uid(),(input->>'requestId')::uuid) returning * into r;
return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create or replace function public.update_task(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.tasks;
begin
perform private.require_active(); perform private.keys(input,array['id','expectedRevision','body','dueDate']::text[],array['id','expectedRevision','body','dueDate']::text[]);
select * into r from public.tasks where id=(input->>'id')::uuid and deleted_at is null for update; if not found then perform private.fail('NOT_FOUND'); end if; perform private.require_project(r.project_id,'member'); perform private.revision(r.revision,input->'expectedRevision');
update public.tasks set body=btrim(input->>'body'),due_date=(input->>'dueDate')::date,revision=revision+1,updated_at=now() where id=r.id returning * into r;
return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

drop function private.check_assignee(uuid,text);
drop index public.tasks_assignee;
alter table public.tasks drop column assignee_id;
commit;
