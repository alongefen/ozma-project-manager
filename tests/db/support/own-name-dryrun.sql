-- ACCOUNT-SELF-SERVICE dry run for update_own_name. Appended after the migration text by the runner.
-- ONE transaction that always ends in an exception, so NOTHING persists (the migration itself is rolled back too).
-- Fake rows use @example.invalid. Needs Alon's yes before it is run against the cloud project.
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
declare a uuid; b uuid; c uuid; r text; bad text;
begin
 a:=pg_temp.mkuser(1); b:=pg_temp.mkuser(2); c:=pg_temp.mkuser(3);
 insert into public.profiles(id,email,full_name,is_owner) values(a,'dry1@example.invalid','שם א',true);
 insert into public.profiles(id,email,full_name) values(b,'dry2@example.invalid','שם ב');
 insert into public.profiles(id,email,full_name,is_active) values(c,'dry3@example.invalid','שם ג',false);
 -- a plain user changes only their own name
 perform pg_temp.chk('plain user renames self','ok:',pg_temp.try('authenticated',b,b,'update_own_name',jsonb_build_object('fullName','  שם חדש ','expectedRevision',pg_temp.rev(b))));
 perform pg_temp.chk('name trimmed and stored','שם חדש',(select full_name from public.profiles where id=b));
 perform pg_temp.chk('revision bumped','2',pg_temp.rev(b)::text);
 perform pg_temp.chk('other person untouched','שם א',(select full_name from public.profiles where id=a));
 perform pg_temp.chk('audit row names the actor','1',(select count(*)::text from public.sensitive_events where action='user.updated' and entity_id=b::text and actor_id=b));
 -- same name again is a no-op (no revision bump)
 perform pg_temp.chk('same name no-op','ok:',pg_temp.try('authenticated',b,b,'update_own_name',jsonb_build_object('fullName','שם חדש','expectedRevision',2)));
 perform pg_temp.chk('no-op keeps revision','2',pg_temp.rev(b)::text);
 -- refusals
 perform pg_temp.chk('stale revision','err:CONFLICT',pg_temp.try('authenticated',b,b,'update_own_name',jsonb_build_object('fullName','x','expectedRevision',1)));
 perform pg_temp.chk('empty name','err:VALIDATION',pg_temp.try('authenticated',b,b,'update_own_name',jsonb_build_object('fullName','   ','expectedRevision',2)));
 perform pg_temp.chk('121 chars','err:VALIDATION',pg_temp.try('authenticated',b,b,'update_own_name',jsonb_build_object('fullName',repeat('א',121),'expectedRevision',2)));
 perform pg_temp.chk('number as name','err:VALIDATION',pg_temp.try('authenticated',b,b,'update_own_name',jsonb_build_object('fullName',5,'expectedRevision',2)));
 perform pg_temp.chk('extra key (id of another person)','err:',pg_temp.try('authenticated',b,b,'update_own_name',jsonb_build_object('fullName','x','expectedRevision',2,'id',a)));
 perform pg_temp.chk('deactivated person refused','err:',pg_temp.try('authenticated',c,c,'update_own_name',jsonb_build_object('fullName','x','expectedRevision',1)));
 perform pg_temp.chk('anon refused','err:permission denied',pg_temp.try('anon',null,null,'update_own_name',jsonb_build_object('fullName','x','expectedRevision',1)));
 perform pg_temp.chk('service_role refused','err:permission denied',pg_temp.try('service_role',null,null,'update_own_name',jsonb_build_object('fullName','x','expectedRevision',1)));
 perform pg_temp.chk('grant: authenticated only','authenticated',(select string_agg(grantee,',' order by grantee) from information_schema.routine_privileges where routine_schema='public' and routine_name='update_own_name' and grantee in ('anon','authenticated','service_role','PUBLIC')));
 select string_agg(n||' expected '||expected||' got '||actual, E'\n') into bad from res where not ok;
 raise exception 'DRYRUN RESULT: % of % ok%', (select count(*) from res where ok), (select count(*) from res), coalesce(E'\n'||bad,'');
end $t$;
