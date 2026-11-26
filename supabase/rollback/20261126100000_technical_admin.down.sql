-- Rollback for 20261126100000_technical_admin.sql. NOT a migration: run by hand, only after Alon's yes.
-- Restores list_project_assignees(p) from 20261125150000 and drops the new function and column (the flag values are lost).
-- Deploy the app version without the flag first (or at the same time): the old app selects no technical_admin column.
begin;
drop function public.list_project_assignees(uuid,uuid[]);
create function public.list_project_assignees(p uuid) returns table(user_id uuid, full_name text, role public.project_role, is_owner boolean)
 language sql stable security definer set search_path='' as $$
 select pr.id, pr.full_name, m.role, pr.is_owner
 from public.profiles pr left join public.memberships m on m.user_id=pr.id and m.project_id=p
 where pr.is_active and (pr.is_owner or m.user_id is not null) and private.member(p)
 order by pr.is_owner desc, pr.full_name, pr.id
$$;
revoke all on function public.list_project_assignees(uuid) from public, anon;
grant execute on function public.list_project_assignees(uuid) to authenticated;
drop function public.set_technical_admin(jsonb);
alter table public.profiles drop column technical_admin;
commit;
