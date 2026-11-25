-- Rollback for 20261125130000_task_assignee_list.sql. NOT a migration: run by hand, only after Alon's yes. Touches no data.
drop function public.list_project_assignees(uuid);
