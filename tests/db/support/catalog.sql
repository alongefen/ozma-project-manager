-- Read-only deployment audit. Run through the approved Management API, not service_role.
select jsonb_build_object(
 'tables', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),
 'allRls', (select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),
 'anonymousExecute', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and has_function_privilege('anon',p.oid,'execute')),
 'directWrites', (select count(*) from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','service_role') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')),
 'unsafeSearchPath', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and not coalesce(p.proconfig @> array['search_path=""'],false)),
 'publicFunctions', (select jsonb_agg(p.proname order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'),
 'systemForAuthenticated', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'system_%' and has_function_privilege('authenticated',p.oid,'execute')),
 'userRpcForService', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname not like 'system_%' and has_function_privilege('service_role',p.oid,'execute')),
 'hookForAuthAdmin', has_function_privilege('supabase_auth_admin','private.reject_auth_email(jsonb)','execute'),
 'hookForAuthenticated', has_function_privilege('authenticated','private.reject_auth_email(jsonb)','execute')
);
