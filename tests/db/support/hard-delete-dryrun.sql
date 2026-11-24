-- HARD-DELETE dry run. Appended after the migration text by the runner (docs/tasks/HARD-DELETE.md).
-- ONE transaction that always ends in an exception, so NOTHING persists (the migration is rolled back too).
-- Fake rows only (@example.invalid). Storage objects are not touched here (SQL cannot); see tests/db/hard-delete.test.ts.
create temp table res(n text, expected text, actual text, ok boolean);
create function pg_temp.chk(n text, expected text, actual text) returns void language sql as $$
 insert into res values(n,expected,actual,actual like expected||'%') $$;
create function pg_temp.try(r text, uid uuid, fn text, input jsonb) returns text language plpgsql as $f$
declare o jsonb;
begin
 perform set_config('request.jwt.claims', jsonb_build_object('sub',uid,'role',r,'session_id',uid)::text, true);
 perform set_config('request.jwt.claim.sub', coalesce(uid::text,''), true);
 execute format('set local role %I', r);
 begin
  execute format('select public.%I($1)', fn) into o using input;
  reset role; return 'ok:'||coalesce(o::text,'null');
 exception when others then reset role; return 'err:'||sqlerrm;
 end;
end $f$;
create function pg_temp.sql(r text, uid uuid, stmt text) returns text language plpgsql as $f$
begin
 perform set_config('request.jwt.claims', jsonb_build_object('sub',uid,'role',r,'session_id',uid)::text, true);
 execute format('set local role %I', r);
 begin execute stmt; reset role; return 'ok';
 exception when others then reset role; return 'err:'||sqlerrm; end;
end $f$;
create function pg_temp.mkuser(i int) returns uuid language plpgsql as $f$
declare u uuid:=('00000000-0000-4000-8000-0000000001'||lpad(i::text,2,'0'))::uuid;
begin
 insert into auth.users(id,email,aud,role) values(u,'hd'||i||'@example.invalid','authenticated','authenticated');
 insert into auth.sessions(id,user_id,created_at) values(u,u,now()-interval '1 minute');
 return u;
end $f$;
create function pg_temp.file(p uuid, u uuid, purpose text, nm text) returns uuid language plpgsql as $f$
declare f uuid:=gen_random_uuid();
begin
 insert into public.stored_files(id,purpose,project_id,uploaded_by,original_name,bucket,object_path,declared_mime,declared_size,mime,size_bytes,sha256,state,ready_at,display_path,display_state)
 values(f,purpose::public.file_purpose,p,u,nm,'originals',p||'/'||f,'image/png',8,'image/png',8,repeat('a',64),'ready',now(),p||'/'||f||'.jpg','ready');
 return f;
end $f$;
create function pg_temp.ev(p uuid, ent text, eid text, act text) returns void language sql as $$
 insert into public.sensitive_events(actor_label,action,entity_type,entity_id,project_id,after) values('x',act,ent,eid,p,'{"secret":"content"}') $$;

do $t$
declare o uuid; m uuid; w uuid; pa uuid:=gen_random_uuid(); pb uuid:=gen_random_uuid();
 fa1 uuid; fa2 uuid; fb1 uuid; fb2 uuid; fc uuid; da uuid:=gen_random_uuid(); db uuid:=gen_random_uuid(); db2 uuid:=gen_random_uuid();
 ea uuid:=gen_random_uuid(); ec uuid:=gen_random_uuid(); en uuid:=gen_random_uuid(); ta uuid:=gen_random_uuid(); tn uuid:=gen_random_uuid(); tb uuid:=gen_random_uuid();
 att uuid:=gen_random_uuid(); r text; cnt int; t text; trg text;
begin
 o:=pg_temp.mkuser(1); m:=pg_temp.mkuser(2); w:=pg_temp.mkuser(3);
 insert into public.profiles(id,email,full_name,is_owner) values(o,'hd1@example.invalid','בעלים בדוי',true);
 insert into public.profiles(id,email,full_name) values(m,'hd2@example.invalid','מנהל בדוי'),(w,'hd3@example.invalid','עובד בדוי');
 -- project A (to be deleted) and project B (must stay intact)
 insert into public.projects(id,name,business_name,site_address,created_by,request_id) values(pa,'פרויקט א בדוי','עסק','כתובת',o,gen_random_uuid()),(pb,'פרויקט ב בדוי','עסק','כתובת',o,gen_random_uuid());
 insert into public.memberships(project_id,user_id,role) values(pa,m,'manager'),(pa,w,'worker'),(pb,m,'manager');
 insert into public.project_contacts(project_id,name,phone) values(pa,'איש','0'),(pb,'איש','0');
 insert into public.project_private(project_id,business_number) values(pa,'1'),(pb,'2');
 insert into public.project_finance_settings(project_id) values(pa),(pb);
 insert into public.tasks(project_id,body,created_by,request_id) values(pa,'משימה',o,gen_random_uuid()),(pb,'משימה',o,gen_random_uuid());
 fa1:=pg_temp.file(pa,o,'document','a1.png'); fa2:=pg_temp.file(pa,o,'diary','a2.png'); fc:=pg_temp.file(pa,o,'cover','cover.png');
 fb1:=pg_temp.file(pb,o,'document','b1.png'); fb2:=pg_temp.file(pb,o,'diary','b2.png');
 insert into public.project_covers(project_id,file_id,created_by) values(pa,fc,o);
 insert into public.documents(id,project_id,file_id,category,access,uploaded_by,uploaded_by_name,archived_at) values(da,pa,fa1,'plans','all',o,'x',now());
 insert into public.documents(id,project_id,file_id,category,access,uploaded_by,uploaded_by_name,archived_at,replaces_document_id) values(db,pb,fb1,'plans','all',o,'x',now(),null);
 insert into public.diary_entries(id,project_id,work_date,body,reporter_id,reporter_name,request_id,cancelled_at,cancelled_by) values(ea,pa,'2026-11-01','דיווח',o,'x',gen_random_uuid(),now(),o);
 insert into public.diary_versions(entry_id,version,kind,project_id,work_date,body,cancelled,reporter_name,editor_id,editor_name) values(ea,1,'created',pa,'2026-11-01','דיווח',false,'x',o,'x'),(ea,2,'cancelled',pa,'2026-11-01','דיווח',true,'x',o,'x');
 insert into public.diary_attachments(id,entry_id,file_id) values(att,ea,fa2);
 insert into public.diary_version_files(entry_id,version,attachment_id,position) values(ea,1,att,1);
 insert into public.diary_entries(id,project_id,work_date,body,reporter_id,reporter_name,request_id) values(en,pb,'2026-11-02','פעיל',o,'x',gen_random_uuid());
 insert into public.diary_versions(entry_id,version,kind,project_id,work_date,body,cancelled,reporter_name,editor_id,editor_name) values(en,1,'created',pb,'2026-11-02','פעיל',false,'x',o,'x');
 insert into public.diary_attachments(id,entry_id,file_id) values(gen_random_uuid(),en,fb2);
 insert into public.diary_version_files(entry_id,version,attachment_id,position) select en,1,id,1 from public.diary_attachments where entry_id=en;
 insert into public.diary_entries(id,project_id,work_date,body,reporter_id,reporter_name,request_id,cancelled_at,cancelled_by) values(ec,pb,'2026-11-03','בוטל ללא קבצים',o,'x',gen_random_uuid(),now(),o);
 insert into public.diary_versions(entry_id,version,kind,project_id,work_date,body,cancelled,reporter_name,editor_id,editor_name) values(ec,1,'created',pb,'2026-11-03','בוטל ללא קבצים',false,'x',o,'x');
 insert into public.transactions(id,project_id,year,month,kind,amount,details,cancelled_at,cancelled_by,created_by,updated_by,request_id) values(ta,pa,2026,11,'income',5,'x',now(),o,o,o,gen_random_uuid()),(tb,pb,2026,11,'income',6,'x',now(),o,o,o,gen_random_uuid()),(tn,pb,2026,11,'income',7,'x',null,null,o,o,gen_random_uuid());
 perform pg_temp.ev(pa,'project',pa::text,'project.created'); perform pg_temp.ev(pa,'transaction',ta::text,'transaction.cancelled');
 perform pg_temp.ev(pb,'document',db::text,'document.created'); perform pg_temp.ev(pb,'entry',ec::text,'entry.cancelled'); perform pg_temp.ev(pb,'transaction',tb::text,'transaction.cancelled');
 perform pg_temp.ev(pb,'project',pb::text,'project.created');

 -- 1. who may call: managers, workers, anonymous and service_role never; the owner is refused on active items
 foreach t in array array['hard_delete_project','hard_delete_document','hard_delete_entry','hard_delete_transaction','hard_delete_preview'] loop
  perform pg_temp.chk(t||' manager refused','err:FORBIDDEN',pg_temp.try('authenticated',m,t,jsonb_build_object('id',pa,'kind','project','confirmName','x')));
  perform pg_temp.chk(t||' worker refused','err:FORBIDDEN',pg_temp.try('authenticated',w,t,jsonb_build_object('id',pa,'kind','project','confirmName','x')));
  perform pg_temp.chk(t||' anon denied','err:permission denied',pg_temp.try('anon',null,t,jsonb_build_object('id',pa)));
  perform pg_temp.chk(t||' service_role denied','err:permission denied',pg_temp.try('service_role',null,t,jsonb_build_object('id',pa)));
 end loop;
 perform pg_temp.chk('manager refused even on an archived document','err:FORBIDDEN',pg_temp.try('authenticated',m,'hard_delete_document',jsonb_build_object('id',da,'confirmName','a1.png')));
 perform pg_temp.chk('queue functions: authenticated denied','err:permission denied',pg_temp.try('authenticated',o,'system_storage_pending','{}'::jsonb));
 perform pg_temp.chk('queue functions: anon denied','err:permission denied',pg_temp.try('anon',null,'system_storage_done',jsonb_build_object('ids',jsonb_build_array(1))));
 perform pg_temp.chk('active project refused','err:CONFLICT',pg_temp.try('authenticated',o,'hard_delete_project',jsonb_build_object('id',pa,'confirmName','פרויקט א בדוי')));

 update public.documents set archived_at=null where id=db;
 perform pg_temp.chk('un-archived document refused','err:CONFLICT',pg_temp.try('authenticated',o,'hard_delete_document',jsonb_build_object('id',db,'confirmName','b1.png')));
 update public.documents set archived_at=now() where id=db;
 perform pg_temp.chk('active entry refused','err:CONFLICT',pg_temp.try('authenticated',o,'hard_delete_entry',jsonb_build_object('id',en)));
 perform pg_temp.chk('active transaction refused','err:CONFLICT',pg_temp.try('authenticated',o,'hard_delete_transaction',jsonb_build_object('id',tn)));
 perform pg_temp.chk('unknown id','err:NOT_FOUND',pg_temp.try('authenticated',o,'hard_delete_transaction',jsonb_build_object('id',gen_random_uuid())));
 perform pg_temp.chk('bad kind','err:VALIDATION',pg_temp.try('authenticated',o,'hard_delete_preview',jsonb_build_object('id',pa,'kind','user')));
 perform pg_temp.chk('extra key','err:VALIDATION',pg_temp.try('authenticated',o,'hard_delete_transaction',jsonb_build_object('id',tb,'confirmName','x')));
 perform pg_temp.chk('preview works for the owner','ok:',pg_temp.try('authenticated',o,'hard_delete_preview',jsonb_build_object('id',pa,'kind','project')));
 perform pg_temp.chk('preview says not eligible while active','t',(position('"eligible": false' in pg_temp.try('authenticated',o,'hard_delete_preview',jsonb_build_object('id',pa,'kind','project')))>0)::text);

 -- 2. wrong name never deletes; the triggers still protect everything afterwards
 update public.projects set archived_at=now() where id=pa;
 perform pg_temp.chk('project: wrong name refused','err:VALIDATION',pg_temp.try('authenticated',o,'hard_delete_project',jsonb_build_object('id',pa,'confirmName','אחר')));
 perform pg_temp.chk('project still there after refusal','1',(select count(*) from public.projects where id=pa)::text);
 perform pg_temp.chk('entry with files: no name refused','err:VALIDATION',pg_temp.try('authenticated',o,'hard_delete_entry',jsonb_build_object('id',ea)));
 perform pg_temp.chk('document: wrong name refused','err:VALIDATION',pg_temp.try('authenticated',o,'hard_delete_document',jsonb_build_object('id',da,'confirmName','nope')));

 -- 3. one transaction, one document, one entry (with files), then the whole project
 perform pg_temp.chk('transaction deleted','ok:',pg_temp.try('authenticated',o,'hard_delete_transaction',jsonb_build_object('id',tb)));
 perform pg_temp.chk('transaction gone, its history gone','0',(select (select count(*) from public.transactions where id=tb)+(select count(*) from public.sensitive_events where entity_id=tb::text and action='transaction.cancelled'))::text);
 perform pg_temp.chk('transaction audit row, no content','1',(select count(*) from public.sensitive_events where action='transaction.deleted' and entity_id=tb::text and after='{}'::jsonb and project_id=pb)::text);
 perform pg_temp.chk('document deleted','ok:',pg_temp.try('authenticated',o,'hard_delete_document',jsonb_build_object('id',db,'confirmName','b1.png')));
 perform pg_temp.chk('document and file gone, 2 paths queued','0/2',(select (select count(*) from public.documents where id=db)||'/'||(select count(*) from private.storage_deletions where path like pb||'/'||fb1||'%')));
 perform pg_temp.chk('entry without files: no name needed','ok:',pg_temp.try('authenticated',o,'hard_delete_entry',jsonb_build_object('id',ec)));
 perform pg_temp.chk('entry without files: all gone','0',(select (select count(*) from public.diary_entries where id=ec)+(select count(*) from public.diary_versions where entry_id=ec))::text);
 perform pg_temp.chk('project B untouched so far (active entry)','1',(select count(*) from public.diary_entries where id=en)::text);
 perform pg_temp.chk('entry A: deleted with name','ok:',pg_temp.try('authenticated',o,'hard_delete_entry',jsonb_build_object('id',ea,'confirmName','01/11/2026')));
 perform pg_temp.chk('entry A: versions/attachments/links/file gone','0',(select (select count(*) from public.diary_versions where entry_id=ea)+(select count(*) from public.diary_attachments where entry_id=ea)+(select count(*) from public.diary_version_files where entry_id=ea)+(select count(*) from public.stored_files where id=fa2))::text);
 perform pg_temp.chk('entry audit row: name only','1',(select count(*) from public.sensitive_events where action='entry.deleted' and entity_id=ea::text and after->>'name'='01/11/2026' and not after ? 'body')::text);
 select count(*) into cnt from public.stored_files where project_id=pa;
 perform pg_temp.chk('project A files before delete (doc+cover)','2',cnt::text);
 r:=pg_temp.try('authenticated',o,'hard_delete_project',jsonb_build_object('id',pa,'confirmName','פרויקט א בדוי'));
 perform pg_temp.chk('project A deleted','ok:',r);
 perform pg_temp.chk('project A: no row left in any table','0',(select
  (select count(*) from public.projects where id=pa)+(select count(*) from public.memberships where project_id=pa)+(select count(*) from public.project_contacts where project_id=pa)
  +(select count(*) from public.project_private where project_id=pa)+(select count(*) from public.project_finance_settings where project_id=pa)+(select count(*) from public.tasks where project_id=pa)
  +(select count(*) from public.stored_files where project_id=pa)+(select count(*) from public.project_covers where project_id=pa)+(select count(*) from public.documents where project_id=pa)
  +(select count(*) from public.diary_entries where project_id=pa)+(select count(*) from public.diary_versions where project_id=pa)+(select count(*) from public.transactions where project_id=pa)
  +(select count(*) from public.sensitive_events where project_id=pa))::text);
 perform pg_temp.chk('project A: its storage paths are queued (doc, cover, entry file; each with a display copy)','6',(select count(*) from private.storage_deletions where path like pa||'/%')::text);
 perform pg_temp.chk('project A: one audit row, no project link, no content','1',(select count(*) from public.sensitive_events where action='project.deleted' and entity_id=pa::text and project_id is null and after->>'name'='פרויקט א בדוי' and (after-'name'-'counts')='{}'::jsonb)::text);
 perform pg_temp.chk('project A deletion counts in the audit row','1',(select (after->'counts'->>'documents')::int from public.sensitive_events where action='project.deleted' and entity_id=pa::text)::text);
 perform pg_temp.chk('project B untouched','1/1/1/1',(select (select count(*) from public.projects where id=pb)||'/'||(select count(*) from public.memberships where project_id=pb)||'/'||(select count(*) from public.tasks where project_id=pb)||'/'||(select count(*) from public.diary_entries where id=en)));
 perform pg_temp.chk('project B file of the active entry still there','1',(select count(*) from public.stored_files where id=fb2)::text);

 -- 4. immutability is intact afterwards for everybody (also after refusals and after a successful delete)
 foreach trg in array array['diary_versions','diary_version_files','diary_attachments','sensitive_events','diary_entries','stored_files','transactions'] loop
  perform pg_temp.chk('postgres DELETE on '||trg||' still refused','err:FORBIDDEN',pg_temp.sql('postgres',null,format('delete from public.%I',trg)));
  perform pg_temp.chk('owner (authenticated) DELETE on '||trg||' refused','err:permission denied',pg_temp.sql('authenticated',o,format('delete from public.%I',trg)));
  perform pg_temp.chk('service_role DELETE on '||trg||' refused','err:permission denied',pg_temp.sql('service_role',null,format('delete from public.%I',trg)));
 end loop;
 perform pg_temp.chk('postgres UPDATE rules unchanged (diary_versions)','err:FORBIDDEN',pg_temp.sql('postgres',null,'update public.diary_versions set body=body'));
 perform pg_temp.chk('postgres UPDATE rules unchanged (cancelled transaction)','err:FORBIDDEN',pg_temp.sql('postgres',null,'update public.transactions set details=details where cancelled_at is not null'));
 perform pg_temp.chk('the setting is cleared after the functions','',coalesce(current_setting('ozma.hard_delete',true),''));
 perform pg_temp.chk('all 7 triggers enabled','7',(select count(*) from pg_trigger where tgname like 'immutable\_%' and tgenabled='O')::text);
 perform pg_temp.chk('no trigger is disabled','0',(select count(*) from pg_trigger where tgname like 'immutable\_%' and tgenabled<>'O')::text);
 -- a failing hard delete (wrong name) leaves the protection on and the setting cleared
 perform pg_temp.try('authenticated',o,'hard_delete_project',jsonb_build_object('id',pb,'confirmName','לא נכון'));
 perform pg_temp.chk('after an error: still refused','err:FORBIDDEN',pg_temp.sql('postgres',null,'delete from public.stored_files'));
 -- the queue helpers carry no API privileges
 perform pg_temp.chk('private helpers not executable by API roles','0',(select count(*) from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='private' and p.proname like any(array['hard_delete%','queue_%']) and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute') or has_function_privilege('service_role',p.oid,'execute')))::text);
 perform pg_temp.chk('queue table has no API privileges','f',(select has_table_privilege('authenticated','private.storage_deletions','select') or has_table_privilege('service_role','private.storage_deletions','select') or has_table_privilege('anon','private.storage_deletions','select'))::text);
 perform pg_temp.chk('grants: 5 for authenticated, 2 service only','5/2/0',(select (select count(*) from pg_proc where proname like 'hard\_delete\_%' and pronamespace='public'::regnamespace and has_function_privilege('authenticated',oid,'execute'))||'/'||(select count(*) from pg_proc where proname like 'system\_storage\_%' and has_function_privilege('service_role',oid,'execute'))||'/'||(select count(*) from pg_proc where proname like any(array['hard\_delete\_%','system\_storage\_%']) and pronamespace='public'::regnamespace and (has_function_privilege('anon',oid,'execute') or has_function_privilege('public',oid,'execute')))));
 perform pg_temp.chk('all 7 functions: security definer + empty search_path','7',(select count(*) from pg_proc p where pronamespace='public'::regnamespace and proname like any(array['hard\_delete\_%','system\_storage\_%']) and prosecdef and proconfig @> array['search_path=""'])::text);
 raise exception 'DRYRUN %', (select jsonb_build_object('failed',(select count(*) from res where not ok),'total',(select count(*) from res),'rows',(select jsonb_agg(jsonb_build_object('n',res.n,'exp',res.expected,'got',left(res.actual,120))) from res where not res.ok)));
end $t$;
