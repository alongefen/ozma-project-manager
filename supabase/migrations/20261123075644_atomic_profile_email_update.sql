-- P1.3-PROFILE-UPDATE: applied to the dev project after D31 approval (23.11.2026).
begin;
-- One row per target: the pending intent of an email edit, or the receipt of the last completed edit. No backfill.
create table private.profile_updates (
 user_id uuid primary key references public.profiles on delete restrict,
 actor_id uuid not null references public.profiles on delete restrict,
 session_id uuid not null, base_revision int not null check(base_revision>0),
 email text not null check (email=lower(btrim(email)) and email !~ '\s'),
 full_name text not null check (length(btrim(full_name)) between 1 and 120),
 created_at timestamptz not null, completed boolean not null
);
alter table private.profile_updates enable row level security;
revoke all on private.profile_updates from public,anon,authenticated,service_role;

create function public.prepare_profile_update(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.profiles; target_email text; target_name text; email_pending boolean;
begin
perform private.require_owner();
perform private.keys(input,array['id','expectedRevision','fullName','email']::text[],array['id','expectedRevision','fullName','email']::text[]);
target_email:=lower(btrim(input->>'email')); target_name:=btrim(input->>'fullName');
-- auth.users.email is varchar(255).
if target_email is null or length(target_email)>255 or target_email !~ '^[^[:space:]@]+@[^[:space:]@]+$' then perform private.fail('VALIDATION','email'); end if;
select * into r from public.profiles where id=(input->>'id')::uuid for update;
if not found then perform private.fail('NOT_FOUND'); end if;
-- Compared as jsonb: expectedRevision is not validated until private.revision below.
if exists(select 1 from private.profile_updates p where p.user_id=r.id and p.completed and p.actor_id=auth.uid()
 and to_jsonb(p.base_revision)=input->'expectedRevision' and p.email=target_email and p.full_name=target_name and r.revision=p.base_revision+1) then
 return private.saved(r.id,r.revision)||jsonb_build_object('emailPending',false);
end if;
perform private.revision(r.revision,input->'expectedRevision');
if exists(select 1 from public.profiles p where p.email=target_email and p.id<>r.id)
 or exists(select 1 from auth.users u where lower(u.email)=target_email and u.id<>r.id) then perform private.fail('CONFLICT'); end if;
-- A separate statement after the profile lock, so it sees any email change that committed while waiting.
select lower(u.email) is distinct from target_email into email_pending from auth.users u where u.id=r.id;
insert into private.profile_updates(user_id,actor_id,session_id,base_revision,email,full_name,created_at,completed)
 values(r.id,auth.uid(),(auth.jwt()->>'session_id')::uuid,r.revision,target_email,target_name,clock_timestamp(),not email_pending)
 on conflict(user_id) do update set actor_id=excluded.actor_id,session_id=excluded.session_id,base_revision=excluded.base_revision,
 email=excluded.email,full_name=excluded.full_name,created_at=excluded.created_at,completed=excluded.completed;
if not email_pending then
 update public.profiles set full_name=target_name,email=target_email,revision=revision+1,updated_at=now() where id=r.id returning * into r;
 perform private.audit('user.updated','profile',r.id::text);
end if;
return private.saved(r.id,r.revision)||jsonb_build_object('emailPending',email_pending);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

-- Runs inside the Auth provider's transaction: any failure here also rolls back its email, identity and token changes.
create function private.apply_profile_email() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.profiles; intent private.profile_updates;
begin
select * into r from public.profiles where id=new.id for update;
if not found then return null; end if;
select * into intent from private.profile_updates where user_id=r.id;
if not found or intent.completed or intent.email is distinct from lower(new.email) or intent.base_revision<>r.revision
 or intent.created_at<=clock_timestamp()-interval '1 minute' then perform private.fail('CONFLICT'); end if;
-- Prevent revocation of the owner racing this write, as in private.require_active.
perform 1 from public.profiles where id=intent.actor_id for share;
if not exists(select 1 from public.profiles a join auth.sessions s on s.user_id=a.id
 where a.id=intent.actor_id and a.is_owner and a.is_active and s.id=intent.session_id and s.created_at>=a.sessions_valid_after) then perform private.fail('CONFLICT'); end if;
update public.profiles set full_name=intent.full_name,email=intent.email,revision=revision+1,updated_at=now() where id=r.id;
update private.profile_updates set completed=true where user_id=r.id;
-- auth.uid() is null on the provider connection, so private.audit cannot name the actor.
insert into public.sensitive_events(actor_id,actor_label,action,entity_type,entity_id)
 select a.id,a.full_name,'user.updated','profile',r.id::text from public.profiles a where a.id=intent.actor_id;
return null;
end $$;

revoke all on function public.prepare_profile_update(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.prepare_profile_update(jsonb) to authenticated;
revoke all on function private.apply_profile_email() from public,anon,authenticated,service_role;

create trigger apply_profile_email after update of email on auth.users
 for each row when (lower(old.email) is distinct from lower(new.email))
 execute function private.apply_profile_email();
commit;
