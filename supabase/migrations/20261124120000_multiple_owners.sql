-- OWNERS-MIGRATION: allow several owner-level accounts (no new role, no new column).
-- Every policy and function that uses private.owner() keeps working unchanged.
-- Rollback: supabase/rollback/20261124120000_multiple_owners.down.sql (not a migration; never auto-applied).

drop index if exists public.one_owner;

-- One extra audit action for demotion. The old list is kept as is; rows are never touched.
alter table public.sensitive_events drop constraint sensitive_events_action_check;
alter table public.sensitive_events add constraint sensitive_events_action_check check(action in
 ('user.created','user.updated','user.active_changed','user.password_reset',
 'membership.changed','membership.removed','membership.finance_changed','project.created','project.updated',
 'project.status_changed','project.archive_changed','project.cover_changed','document.created','document.replaced',
 'document.access_changed','document.archive_changed','task.deleted','entry.corrected','entry.moved','entry.cancelled',
 'transaction.created','transaction.updated','transaction.cancelled','finance.link_changed','owner.created','owner.password_recovered',
 'owner.demoted'));

-- An owner may now deactivate another owner. The table rule "an owner is always active" stays, so
-- deactivating an owner also removes the owner level in the same statement. Never yourself, never the last one.
create or replace function public.set_user_active(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.profiles; old_active boolean; old_owner boolean;
begin
perform private.require_owner(); perform private.keys(input,array['id','expectedRevision','active']::text[],array['id','expectedRevision','active']::text[]);
perform pg_advisory_xact_lock(190012,1);
select * into r from public.profiles where id=(input->>'id')::uuid for update;
if not found then perform private.fail('NOT_FOUND'); end if;
perform private.revision(r.revision,input->'expectedRevision');
if jsonb_typeof(input->'active')<>'boolean' then perform private.fail('VALIDATION','active'); end if;
if r.is_owner and (r.id=auth.uid() or not exists(select 1 from public.profiles where is_owner and is_active and id<>r.id)) then perform private.fail('FORBIDDEN'); end if;
old_active:=r.is_active; old_owner:=r.is_owner;
update public.profiles set is_active=(input->>'active')::boolean, is_owner=case when (input->>'active')::boolean then is_owner else false end,
 sessions_valid_after=clock_timestamp(),revision=revision+1,updated_at=now() where id=r.id returning * into r;
perform private.audit('user.active_changed','profile',r.id::text,null,jsonb_build_object('active',old_active,'isOwner',old_owner),jsonb_build_object('active',r.is_active,'isOwner',r.is_owner));
return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

-- Promote or demote an owner-level account. Never yourself, never the last active owner.
create function public.set_owner_level(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.profiles;
begin
perform private.require_owner(); perform private.keys(input,array['userId','enabled','expectedRevision']::text[],array['userId','enabled','expectedRevision']::text[]);
if jsonb_typeof(input->'enabled')<>'boolean' then perform private.fail('VALIDATION','enabled'); end if;
perform pg_advisory_xact_lock(190012,1);
select * into r from public.profiles where id=(input->>'userId')::uuid for update;
if not found then perform private.fail('NOT_FOUND'); end if;
perform private.revision(r.revision,input->'expectedRevision');
if r.id=auth.uid() or not r.is_active then perform private.fail('FORBIDDEN'); end if;
if r.is_owner=(input->>'enabled')::boolean then return private.saved(r.id,r.revision); end if;
if r.is_owner and not exists(select 1 from public.profiles where is_owner and is_active and id<>r.id) then perform private.fail('FORBIDDEN'); end if;
update public.profiles set is_owner=(input->>'enabled')::boolean,revision=revision+1,updated_at=now() where id=r.id returning * into r;
perform private.audit(case when r.is_owner then 'owner.created' else 'owner.demoted' end,'profile',r.id::text,null,jsonb_build_object('isOwner',not r.is_owner),jsonb_build_object('isOwner',r.is_owner));
return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

-- Service only: creates or promotes an owner-level profile. Requires an existing active owner. Idempotent per userId.
create function public.system_add_owner(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u auth.users; r public.profiles;
begin
perform private.keys(input,array['userId','fullName']::text[],array['userId','fullName']::text[]);
if length(btrim(input->>'fullName')) not between 1 and 120 then perform private.fail('VALIDATION','fullName'); end if;
perform pg_advisory_xact_lock(190012,1);
if not exists(select 1 from public.profiles where is_owner and is_active) then perform private.fail('FORBIDDEN'); end if;
select * into u from auth.users where id=(input->>'userId')::uuid;
if not found then perform private.fail('NOT_FOUND'); end if;
select * into r from public.profiles where id=u.id for update;
if found then
 if r.is_owner then return private.saved(r.id,r.revision); end if;
 if not r.is_active then perform private.fail('FORBIDDEN'); end if;
 update public.profiles set is_owner=true,revision=revision+1,updated_at=now() where id=r.id returning * into r;
else
 insert into public.profiles(id,email,full_name,is_owner) values(u.id,lower(u.email),btrim(input->>'fullName'),true) returning * into r;
end if;
insert into public.sensitive_events(actor_label,action,entity_type,entity_id,after) values('system','owner.created','profile',r.id::text,jsonb_build_object('isOwner',true));
return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

-- Recovery now names the owner. With exactly one owner, userId may be omitted (the old call keeps working).
create or replace function public.system_owner_recovered(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.profiles; n int;
begin
perform private.keys(input,array['supportId','userId']::text[],array['supportId']::text[]);
if length(btrim(input->>'supportId')) not between 1 and 120 then perform private.fail('VALIDATION'); end if;
if input ? 'userId' then
 update public.profiles set sessions_valid_after=clock_timestamp(),revision=revision+1,updated_at=now() where is_owner and id=(input->>'userId')::uuid returning * into r;
else
 select count(*) into n from public.profiles where is_owner;
 if n>1 then perform private.fail('VALIDATION','userId'); end if;
 update public.profiles set sessions_valid_after=clock_timestamp(),revision=revision+1,updated_at=now() where is_owner returning * into r;
end if;
if not found then perform private.fail('NOT_FOUND'); end if;
insert into public.sensitive_events(actor_label,action,entity_type,entity_id) values(input->>'supportId','owner.password_recovered','profile',r.id::text);
return 'null'::jsonb;
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

revoke all on function public.set_owner_level(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.system_add_owner(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.set_owner_level(jsonb) to authenticated;
grant execute on function public.system_add_owner(jsonb) to service_role;
