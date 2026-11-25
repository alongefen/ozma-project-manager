-- CLIENT-FEEDBACK-C (A-46), second small migration: a read function for the people a task can be assigned to.
-- Why: RLS lets a non-owner read only their own membership and profile (read_memberships / read_profiles), so a worker or manager
-- could not list the other members or show an assignee's name. This function returns id, name and role of the ACTIVE members of ONE project,
-- and only to someone who is a member of that project (an owner-level account counts as a member). Anyone else gets an empty list.
-- It exposes nothing else (no email, no phone). Nothing existing changes; one new function. Cost: none.
-- Rollback: supabase/rollback/20261125130000_task_assignee_list.down.sql
create function public.list_project_assignees(p uuid) returns table(user_id uuid, full_name text, role public.project_role)
 language sql stable security definer set search_path='' as $$
 select m.user_id, pr.full_name, m.role
 from public.memberships m join public.profiles pr on pr.id=m.user_id
 where m.project_id=p and pr.is_active and private.member(p)
 order by pr.full_name, m.user_id
$$;
revoke all on function public.list_project_assignees(uuid) from public, anon;
grant execute on function public.list_project_assignees(uuid) to authenticated;
