-- HIDE-TECH-ADMINS: owner-level accounts that do not work in the business (the two technical admins) are not assignee options.
-- What: NEW column public.profiles.technical_admin (boolean, default false); NEW function public.set_technical_admin (owner only);
-- public.list_project_assignees gains an optional second argument `keep uuid[]` and no longer returns an owner-level account flagged
-- technical_admin, unless its id is in `keep` (the app passes the people already assigned on existing tasks, so they keep a name there).
-- Nothing else changes: technical admins keep full owner rights and stay in the people screen and access lists. Cost: none.
-- Rollback: supabase/rollback/20261126100000_technical_admin.down.sql (not a migration; never auto-applied).
begin;

alter table public.profiles add column technical_admin boolean not null default false;

-- Flag or unflag an owner-level account. Any owner (including the account itself). Audited as user.updated.
create function public.set_technical_admin(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.profiles; old_value boolean;
begin
perform private.require_owner(); perform private.keys(input,array['userId','enabled','expectedRevision']::text[],array['userId','enabled','expectedRevision']::text[]);
if jsonb_typeof(input->'enabled')<>'boolean' then perform private.fail('VALIDATION','enabled'); end if;
select * into r from public.profiles where id=(input->>'userId')::uuid for update;
if not found then perform private.fail('NOT_FOUND'); end if;
perform private.revision(r.revision,input->'expectedRevision');
if not r.is_owner then perform private.fail('VALIDATION','userId'); end if;
old_value:=r.technical_admin;
if old_value=(input->>'enabled')::boolean then return private.saved(r.id,r.revision); end if;
update public.profiles set technical_admin=(input->>'enabled')::boolean,revision=revision+1,updated_at=now() where id=r.id returning * into r;
perform private.audit('user.updated','profile',r.id::text,null,jsonb_build_object('technicalAdmin',old_value),jsonb_build_object('technicalAdmin',r.technical_admin));
return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;
revoke all on function public.set_technical_admin(jsonb) from public, anon, service_role;
grant execute on function public.set_technical_admin(jsonb) to authenticated;

drop function public.list_project_assignees(uuid);
create function public.list_project_assignees(p uuid, keep uuid[] default '{}') returns table(user_id uuid, full_name text, role public.project_role, is_owner boolean, is_technical boolean)
 language sql stable security definer set search_path='' as $$
 select pr.id, pr.full_name, m.role, pr.is_owner, (pr.is_owner and pr.technical_admin)
 from public.profiles pr left join public.memberships m on m.user_id=pr.id and m.project_id=p
 where pr.is_active and (pr.is_owner or m.user_id is not null) and private.member(p)
   and (not (pr.is_owner and pr.technical_admin) or pr.id=any(coalesce(keep,'{}')))
 order by pr.is_owner desc, pr.full_name, pr.id
$$;
revoke all on function public.list_project_assignees(uuid,uuid[]) from public, anon;
grant execute on function public.list_project_assignees(uuid,uuid[]) to authenticated;

commit;
