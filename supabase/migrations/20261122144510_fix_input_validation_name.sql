-- Fix an ambiguous identifier in input validation; no data or permission changes.
begin;
create or replace function private.keys(input jsonb, allowed text[], required text[] default '{}') returns void language plpgsql set search_path='' as $$
declare k text; v jsonb; expected text;
begin
 if input is null or jsonb_typeof(input)<>'object' or exists(select 1 from jsonb_object_keys(input) as input_keys(key_name) where not input_keys.key_name=any(allowed))
 or not input ?& required then perform private.fail('VALIDATION'); end if;
 for k,v in select key,value from jsonb_each(input) loop
  if v='null'::jsonb then
   if k not in ('expectedRevision','startDate','endDate','accessNotes','businessNumber','email','roleTitle','dueDate','day','url','displayPath') then perform private.fail('VALIDATION',k); end if;
   continue;
  end if;
  expected:=case when k in ('fields','contact','access') then 'object'
   when k in ('files','fileIds','userIds') then 'array'
   when k in ('active','enabled','archived','completed','download') then 'boolean'
   when k in ('expectedRevision','year','month','day','amount','sizeBytes') then 'number'
   when k in ('from','to') and jsonb_typeof(v)='object' then 'object' else 'string' end;
  if jsonb_typeof(v)<>expected then perform private.fail('VALIDATION',k); end if;
  if expected='number' and v::text !~ '^[0-9]+$' then perform private.fail('VALIDATION',k); end if;
  if k in ('startDate','endDate','dueDate','workDate','from','to') and expected='string'
   and (v #>> '{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then perform private.fail('VALIDATION',k); end if;
 end loop;
end $$;
commit;
