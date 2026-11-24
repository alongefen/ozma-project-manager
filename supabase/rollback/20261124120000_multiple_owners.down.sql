-- Rollback for 20261124120000_multiple_owners.sql. NOT a migration: run by hand, only after Alon's yes.
-- Step 1 (data): keep ONE owner (the oldest) and demote the others to ordinary users. Their other data is untouched.
-- Cannot undo: demoted accounts keep working as ordinary users (re-assign memberships by hand if needed);
-- audit rows 'owner.demoted' stay; the old action list is NOT restored if such rows exist (it would fail), so the wider list stays.
begin;
update public.profiles set is_owner=false,revision=revision+1,updated_at=now()
 where is_owner and id not in (select id from public.profiles where is_owner order by created_at,id limit 1);
create unique index one_owner on public.profiles (is_owner) where is_owner;
drop function public.set_owner_level(jsonb);
drop function public.system_add_owner(jsonb);
create or replace function public.system_owner_recovered(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.profiles;
begin
perform private.keys(input,array['supportId']::text[],array['supportId']::text[]);
if length(btrim(input->>'supportId')) not between 1 and 120 then perform private.fail('VALIDATION'); end if;
update public.profiles set sessions_valid_after=clock_timestamp(),revision=revision+1,updated_at=now() where is_owner returning * into r;
if not found then perform private.fail('NOT_FOUND'); end if;
insert into public.sensitive_events(actor_label,action,entity_type,entity_id) values(input->>'supportId','owner.password_recovered','profile',r.id::text);
return 'null'::jsonb;
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;
create or replace function public.set_user_active(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.profiles; old_active boolean;
begin
perform private.require_owner(); perform private.keys(input,array['id','expectedRevision','active']::text[],array['id','expectedRevision','active']::text[]);
select * into r from public.profiles where id=(input->>'id')::uuid for update;
if not found then perform private.fail('NOT_FOUND'); end if;
perform private.revision(r.revision,input->'expectedRevision'); if r.is_owner then perform private.fail('FORBIDDEN'); end if; if jsonb_typeof(input->'active')<>'boolean' then perform private.fail('VALIDATION','active'); end if;
old_active:=r.is_active;
update public.profiles set is_active=(input->>'active')::boolean, sessions_valid_after=clock_timestamp(),revision=revision+1,updated_at=now() where id=r.id returning * into r;
perform private.audit('user.active_changed','profile',r.id::text,null,jsonb_build_object('active',old_active),jsonb_build_object('active',r.is_active));
return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;
commit;
