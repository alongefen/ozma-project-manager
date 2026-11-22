-- Qualify every audit input independently of the actor profile columns.
-- Existing append-only events are deliberately left unchanged.
begin;
create or replace function private.audit(
  action text,
  entity text,
  id text,
  project uuid default null,
  old_value jsonb default null,
  new_value jsonb default null
) returns void language sql security definer set search_path='' as $$
  insert into public.sensitive_events(
    actor_id, actor_label, action, entity_type, entity_id, project_id, before, after
  )
  select auth.uid(), actor_profile.full_name, $1, $2, $3, $4, $5, $6
  from public.profiles as actor_profile
  where actor_profile.id = auth.uid()
$$;
commit;
