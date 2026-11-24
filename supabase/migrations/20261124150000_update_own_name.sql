-- ACCOUNT-SELF-SERVICE: a signed-in active person changes their OWN name (any role).
-- Only the name; email, owner level, active flag and memberships are untouched. The caller's id is auth.uid(), never input.
-- Rollback: supabase/rollback/20261124150000_update_own_name.down.sql (not a migration; never auto-applied).
create function public.update_own_name(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.profiles; old_name text;
begin
perform private.require_active(); perform private.keys(input,array['fullName','expectedRevision']::text[],array['fullName','expectedRevision']::text[]);
if jsonb_typeof(input->'fullName')<>'string' or length(btrim(input->>'fullName')) not between 1 and 120 then perform private.fail('VALIDATION','fullName'); end if;
select * into r from public.profiles where id=auth.uid() for update;
if not found then perform private.fail('NOT_FOUND'); end if;
perform private.revision(r.revision,input->'expectedRevision'); old_name:=r.full_name;
if r.full_name=btrim(input->>'fullName') then return private.saved(r.id,r.revision); end if;
update public.profiles set full_name=btrim(input->>'fullName'),revision=revision+1,updated_at=now() where id=r.id returning * into r;
perform private.audit('user.updated','profile',r.id::text,null,jsonb_build_object('fullName',old_name),jsonb_build_object('fullName',r.full_name));
return private.saved(r.id,r.revision);
exception when unique_violation or deadlock_detected then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

revoke all on function public.update_own_name(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.update_own_name(jsonb) to authenticated;
