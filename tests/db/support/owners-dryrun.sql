-- OWNERS-MIGRATION dry run. Appended after the migration text by the runner (see docs/tasks/OWNERS-MIGRATION.md).
-- Everything below runs in ONE transaction that always ends in an exception, so NOTHING persists
-- (the migration itself is rolled back too). Fake rows use @example.invalid.
create temp table res(n text, expected text, actual text, ok boolean);
create function pg_temp.chk(n text, expected text, actual text) returns void language sql as $$
 insert into res values(n,expected,actual,actual like expected||'%') $$;
create function pg_temp.try(r text, uid uuid, sid uuid, fn text, input jsonb) returns text language plpgsql as $f$
declare o jsonb;
begin
 perform set_config('request.jwt.claims', jsonb_build_object('sub',uid,'role',r,'session_id',sid)::text, true);
 perform set_config('request.jwt.claim.sub', coalesce(uid::text,''), true);
 execute format('set local role %I', r);
 begin
  execute format('select public.%I($1)', fn) into o using input;
  reset role; return 'ok:'||coalesce(o::text,'null');
 exception when others then reset role; return 'err:'||sqlerrm;
 end;
end $f$;
create function pg_temp.mkuser(i int) returns uuid language plpgsql as $f$
declare u uuid:=('00000000-0000-4000-8000-0000000000'||lpad(i::text,2,'0'))::uuid;
begin
 insert into auth.users(id,email,aud,role) values(u,'dry'||i||'@example.invalid','authenticated','authenticated');
 insert into auth.sessions(id,user_id,created_at) values(u,u,now()-interval '1 minute');
 return u;
end $f$;
create function pg_temp.rev(u uuid) returns int language sql as $$ select revision from public.profiles where id=u $$;

do $t$
declare a uuid; b uuid; c uuid; d uuid; e uuid; r text; cnt int;
begin
 -- world: no pre-existing owners (rolled back), A = owner, C = plain user, B/D/E = auth users without profile
 update public.profiles set is_owner=false where is_owner; -- allowed only because check is (not owner or active)
 a:=pg_temp.mkuser(1); b:=pg_temp.mkuser(2); c:=pg_temp.mkuser(3); d:=pg_temp.mkuser(4); e:=pg_temp.mkuser(5);
 insert into public.profiles(id,email,full_name,is_owner) values(a,'dry1@example.invalid','בעלים א',true);
 insert into public.profiles(id,email,full_name) values(c,'dry3@example.invalid','משתמש ג');
 insert into public.profiles(id,email,full_name) values(d,'dry4@example.invalid','משתמש ד');
 perform pg_temp.chk('one_owner index is gone','t',(not exists(select 1 from pg_indexes where indexname='one_owner'))::text);
 -- bootstrap keeps its rule
 perform pg_temp.chk('bootstrap refused while an owner exists','err:CONFLICT',pg_temp.try('service_role',null,null,'system_bootstrap_owner',jsonb_build_object('userId',b,'fullName','x')));
 -- system_add_owner: who may call
 perform pg_temp.chk('add_owner anon denied','err:permission denied',pg_temp.try('anon',null,null,'system_add_owner',jsonb_build_object('userId',b,'fullName','x')));
 perform pg_temp.chk('add_owner owner(authenticated) denied','err:permission denied',pg_temp.try('authenticated',a,a,'system_add_owner',jsonb_build_object('userId',b,'fullName','x')));
 perform pg_temp.chk('add_owner unknown user','err:NOT_FOUND',pg_temp.try('service_role',null,null,'system_add_owner',jsonb_build_object('userId',gen_random_uuid(),'fullName','x')));
 perform pg_temp.chk('add_owner extra key rejected','err:VALIDATION',pg_temp.try('service_role',null,null,'system_add_owner',jsonb_build_object('userId',b,'fullName','x','isOwner',false)));
 r:=pg_temp.try('service_role',null,null,'system_add_owner',jsonb_build_object('userId',b,'fullName','אדמין ב'));
 perform pg_temp.chk('add_owner creates owner B','ok:',r);
 perform pg_temp.chk('add_owner idempotent','ok:',pg_temp.try('service_role',null,null,'system_add_owner',jsonb_build_object('userId',b,'fullName','אדמין ב')));
 select count(*) into cnt from public.profiles where id=b and is_owner; perform pg_temp.chk('B is one owner row','1',cnt::text);
 select count(*) into cnt from public.sensitive_events where action='owner.created' and entity_id=b::text; perform pg_temp.chk('one owner.created audit row for B (idempotent)','1',cnt::text);
 perform pg_temp.chk('add_owner promotes existing profile C','ok:',pg_temp.try('service_role',null,null,'system_add_owner',jsonb_build_object('userId',c,'fullName','ignored')));
 update public.profiles set is_owner=false where id=c;
 -- two owners really work through RLS/owner(): B reads all profiles
 execute 'set local role authenticated'; perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated','session_id',b)::text,true); perform set_config('request.jwt.claim.sub',b::text,true);
 select count(*) into cnt from public.profiles; reset role;
 perform pg_temp.chk('owner B sees all profiles (>=3)','t',(cnt>=3)::text);
 -- set_owner_level
 perform pg_temp.chk('set_owner_level anon denied','err:permission denied',pg_temp.try('anon',null,null,'set_owner_level',jsonb_build_object('userId',c,'enabled',true,'expectedRevision',pg_temp.rev(c))));
 perform pg_temp.chk('set_owner_level non-owner refused','err:FORBIDDEN',pg_temp.try('authenticated',c,c,'set_owner_level',jsonb_build_object('userId',c,'enabled',true,'expectedRevision',pg_temp.rev(c))));
 perform pg_temp.chk('set_owner_level service_role denied','err:permission denied',pg_temp.try('service_role',null,null,'set_owner_level',jsonb_build_object('userId',c,'enabled',true,'expectedRevision',pg_temp.rev(c))));
 perform pg_temp.chk('stale revision','err:CONFLICT',pg_temp.try('authenticated',a,a,'set_owner_level',jsonb_build_object('userId',c,'enabled',true,'expectedRevision',pg_temp.rev(c)+5)));
 perform pg_temp.chk('non-boolean enabled','err:VALIDATION',pg_temp.try('authenticated',a,a,'set_owner_level',jsonb_build_object('userId',c,'enabled','yes','expectedRevision',pg_temp.rev(c))));
 perform pg_temp.chk('owner promotes C','ok:',pg_temp.try('authenticated',a,a,'set_owner_level',jsonb_build_object('userId',c,'enabled',true,'expectedRevision',pg_temp.rev(c))));
 perform pg_temp.chk('promoted C acts as owner (can promote D)','ok:',pg_temp.try('authenticated',c,c,'set_owner_level',jsonb_build_object('userId',d,'enabled',true,'expectedRevision',coalesce(pg_temp.rev(d),1))));
 perform pg_temp.chk('promoting a user without profile','err:NOT_FOUND',pg_temp.try('authenticated',a,a,'set_owner_level',jsonb_build_object('userId',e,'enabled',true,'expectedRevision',1)));
 perform pg_temp.chk('self-demotion refused','err:FORBIDDEN',pg_temp.try('authenticated',a,a,'set_owner_level',jsonb_build_object('userId',a,'enabled',false,'expectedRevision',pg_temp.rev(a))));
 perform pg_temp.chk('owner C demotes owner A','ok:',pg_temp.try('authenticated',c,c,'set_owner_level',jsonb_build_object('userId',a,'enabled',false,'expectedRevision',pg_temp.rev(a))));
 perform pg_temp.chk('demoted A is no longer owner','err:FORBIDDEN',pg_temp.try('authenticated',a,a,'create_profile',jsonb_build_object('email','x@example.invalid','fullName','x')));
 select count(*) into cnt from public.sensitive_events where action='owner.demoted' and entity_id=a::text; perform pg_temp.chk('owner.demoted audit row','1',cnt::text);
 -- shrink to owners {B, C}; then {B}
 perform pg_temp.chk('B demotes D','ok:',pg_temp.try('authenticated',b,b,'set_owner_level',jsonb_build_object('userId',d,'enabled',false,'expectedRevision',pg_temp.rev(d))));
 perform pg_temp.chk('B demotes C (leaves B as the only owner)','ok:',pg_temp.try('authenticated',b,b,'set_owner_level',jsonb_build_object('userId',c,'enabled',false,'expectedRevision',pg_temp.rev(c))));
 perform pg_temp.chk('last owner cannot demote self','err:FORBIDDEN',pg_temp.try('authenticated',b,b,'set_owner_level',jsonb_build_object('userId',b,'enabled',false,'expectedRevision',pg_temp.rev(b))));
 perform pg_temp.chk('last owner cannot deactivate self','err:FORBIDDEN',pg_temp.try('authenticated',b,b,'set_user_active',jsonb_build_object('id',b,'active',false,'expectedRevision',pg_temp.rev(b))));
 select count(*) into cnt from public.profiles where is_owner and is_active; perform pg_temp.chk('exactly one owner remains','1',cnt::text);
 -- guard against a lone-owner target even if the actor were another owner: make A owner again, deactivate path
 update public.profiles set is_owner=true where id in (a,c);
 perform pg_temp.chk('non-owner cannot deactivate','err:FORBIDDEN',pg_temp.try('authenticated',d,d,'set_user_active',jsonb_build_object('id',c,'active',false,'expectedRevision',pg_temp.rev(c))));
 -- owner deactivates another owner: sessions die, owner flag removed
 perform pg_temp.chk('A deactivates owner C','ok:',pg_temp.try('authenticated',a,a,'set_user_active',jsonb_build_object('id',c,'active',false,'expectedRevision',pg_temp.rev(c))));
 perform pg_temp.chk('C session no longer valid','ok:null',pg_temp.try('authenticated',c,c,'get_actor','{}'::jsonb));
 select count(*) into cnt from public.profiles where id=c and not is_active and not is_owner; perform pg_temp.chk('C inactive and not owner','1',cnt::text);
 perform pg_temp.chk('A (owner) still active session','ok:{',pg_temp.try('authenticated',a,a,'get_actor','{}'::jsonb));
 perform pg_temp.chk('deactivated C cannot reactivate itself','err:',pg_temp.try('authenticated',c,c,'set_user_active',jsonb_build_object('id',c,'active',true,'expectedRevision',pg_temp.rev(c))));
 perform pg_temp.chk('A reactivates C (as ordinary user)','ok:',pg_temp.try('authenticated',a,a,'set_user_active',jsonb_build_object('id',c,'active',true,'expectedRevision',pg_temp.rev(c))));
 select count(*) into cnt from public.profiles where id=c and is_active and not is_owner; perform pg_temp.chk('C active ordinary user','1',cnt::text);
 perform pg_temp.chk('owner may reset sessions of another owner','ok:null',pg_temp.try('authenticated',a,a,'revoke_user_sessions',jsonb_build_object('id',b)));
 perform pg_temp.chk('B (revoked) session dead','ok:null',pg_temp.try('authenticated',b,b,'get_actor','{}'::jsonb));
 -- recovery
 update public.profiles set is_owner=true where id=b; -- B owner again, A owner: two owners
 perform pg_temp.chk('recovered: no userId with 2 owners -> VALIDATION','err:VALIDATION',pg_temp.try('service_role',null,null,'system_owner_recovered',jsonb_build_object('supportId','dry')));
 perform pg_temp.chk('recovered: non-owner target -> NOT_FOUND','err:NOT_FOUND',pg_temp.try('service_role',null,null,'system_owner_recovered',jsonb_build_object('supportId','dry','userId',c)));
 perform pg_temp.chk('recovered: authenticated denied','err:permission denied',pg_temp.try('authenticated',a,a,'system_owner_recovered',jsonb_build_object('supportId','dry','userId',a)));
 insert into auth.sessions(id,user_id,created_at) values(gen_random_uuid(),b,now()) on conflict do nothing;
 perform pg_temp.chk('recovered: targets owner B only','ok:null',pg_temp.try('service_role',null,null,'system_owner_recovered',jsonb_build_object('supportId','dry','userId',b)));
 perform pg_temp.chk('A session untouched by B recovery','ok:{',pg_temp.try('authenticated',a,a,'get_actor','{}'::jsonb));
 update public.profiles set is_owner=false where id=b;
 perform pg_temp.chk('recovered: single owner, old call shape works','ok:null',pg_temp.try('service_role',null,null,'system_owner_recovered',jsonb_build_object('supportId','dry')));
 -- catalog
 select count(*) into cnt from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname in ('set_owner_level','system_add_owner','set_user_active','system_owner_recovered') and p.prosecdef and p.proconfig @> array['search_path=""'];
 perform pg_temp.chk('4 functions: security definer + empty search_path','4',cnt::text);
 perform pg_temp.chk('anon cannot execute any of them','0',(select count(*) from pg_proc p where p.proname in ('set_owner_level','system_add_owner') and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('public',p.oid,'execute')))::text);
 perform pg_temp.chk('system_add_owner not for authenticated','f',(select has_function_privilege('authenticated','public.system_add_owner(jsonb)','execute'))::text);
 perform pg_temp.chk('set_owner_level not for service_role','f',(select has_function_privilege('service_role','public.set_owner_level(jsonb)','execute'))::text);
 raise exception 'DRYRUN %', (select jsonb_build_object('failed',(select count(*) from res where not ok),'total',(select count(*) from res),'rows',(select jsonb_agg(jsonb_build_object('n',res.n,'exp',res.expected,'got',left(res.actual,90))) from res where not res.ok)));
end $t$;
