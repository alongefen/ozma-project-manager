-- P1.2: first migration. Cloud only. Apply after P1.1 and environment preflight.
begin;
create schema private;
revoke all on schema private from public, anon, authenticated, service_role;
revoke create on schema public from public, anon, authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from public;

create type public.project_role as enum ('manager','worker');
create type public.project_status as enum ('active','completed');
create type public.file_purpose as enum ('document','diary','cover');
create type public.file_state as enum ('pending','ready','rejected');
create type public.display_state as enum ('none','ready','failed');
create type public.document_category as enum ('specification','plans','additional_plans','renderings');
create type public.document_access as enum ('owner','all','selected');
create type public.version_kind as enum ('created','corrected','moved','cancelled');
create type public.transaction_kind as enum ('income','income_refund','expense','expense_credit');

create table public.profiles (
 id uuid primary key references auth.users on delete restrict,
 email text not null unique check (email=lower(btrim(email)) and email !~ '\s'),
 full_name text not null check (length(btrim(full_name)) between 1 and 120),
 is_owner boolean not null default false, is_active boolean not null default true,
 sessions_valid_after timestamptz not null default '-infinity',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 created_by uuid references public.profiles on delete restrict,
 revision int not null default 1 check (revision>0), check (not is_owner or is_active)
);
create unique index one_owner on public.profiles (is_owner) where is_owner;
create table public.projects (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(btrim(name)) between 1 and 200),
 business_name text not null check(length(btrim(business_name)) between 1 and 200),
 site_address text not null check(length(btrim(site_address)) between 1 and 300),
 access_notes text check(length(access_notes)<=2000), start_date date, end_date date,
 status public.project_status not null default 'active', archived_at timestamptz,
 created_by uuid not null references public.profiles on delete restrict, request_id uuid not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 revision int not null default 1 check(revision>0), unique(created_by,request_id),
 check(end_date>=start_date)
);
create index projects_active on public.projects(status,created_at desc) where archived_at is null;
create table public.memberships (
 project_id uuid not null references public.projects on delete restrict,
 user_id uuid not null references public.profiles on delete restrict,
 role public.project_role not null, finance_access boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 revision int not null default 1 check(revision>0), primary key(project_id,user_id),
 check(not finance_access or role='manager')
);
create index memberships_user on public.memberships(user_id,project_id);
create table public.project_contacts (
 project_id uuid primary key references public.projects on delete restrict,
 name text not null check(length(btrim(name)) between 1 and 120),
 phone text not null check(length(btrim(phone)) between 1 and 40), email text,
 role_title text check(length(role_title)<=120)
);
create table public.project_private (
 project_id uuid primary key references public.projects on delete restrict,
 business_number text check(length(business_number)<=30)
);
create table public.project_finance_settings (
 project_id uuid primary key references public.projects on delete restrict,
 excel_url text check(excel_url ~ '^https://[^[:space:]]+$' and length(excel_url)<=2000),
 revision int not null default 1 check(revision>0)
);
create table public.stored_files (
 id uuid primary key default gen_random_uuid(), purpose public.file_purpose not null,
 project_id uuid not null references public.projects on delete restrict,
 uploaded_by uuid not null references public.profiles on delete restrict,
 original_name text not null check(length(btrim(original_name)) between 1 and 255),
 bucket text not null, object_path text not null, declared_mime text not null,
 declared_size bigint not null check(declared_size>0), mime text, size_bytes bigint,
 sha256 text check(sha256 ~ '^[0-9a-f]{64}$'), state public.file_state not null default 'pending',
 display_path text, display_state public.display_state not null default 'none',
 created_at timestamptz not null default now(), ready_at timestamptz,
 unique(bucket,object_path),
 check(declared_size<=case when purpose='document' then 52428800 else 26214400 end),
 check(state<>'ready' or (mime is not null and size_bytes>0 and sha256 is not null and ready_at is not null)),
 check(size_bytes<=case when purpose='document' then 52428800 else 26214400 end),
 check((display_state='ready')=(display_path is not null))
);
create index files_project on public.stored_files(project_id,purpose,created_at);
create table public.project_covers (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects on delete restrict,
 file_id uuid not null unique references public.stored_files on delete restrict, is_active boolean not null default true,
 created_by uuid not null references public.profiles on delete restrict, created_at timestamptz not null default now()
);
create unique index one_cover on public.project_covers(project_id) where is_active;
create table public.documents (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects on delete restrict,
 file_id uuid not null unique references public.stored_files on delete restrict,
 category public.document_category not null, access public.document_access not null,
 uploaded_by uuid not null references public.profiles on delete restrict, uploaded_by_name text not null,
 replaces_document_id uuid, archived_at timestamptz, created_at timestamptz not null default now(),
 revision int not null default 1 check(revision>0), unique(id,project_id),
 foreign key(replaces_document_id,project_id) references public.documents(id,project_id) on delete restrict
);
create index documents_project on public.documents(project_id,category,created_at desc) where archived_at is null;
create index documents_uploader on public.documents(uploaded_by);
create table public.document_grants (
 document_id uuid not null, user_id uuid not null, project_id uuid not null,
 created_at timestamptz not null default now(), primary key(document_id,user_id),
 foreign key(document_id,project_id) references public.documents(id,project_id) on delete restrict,
 foreign key(project_id,user_id) references public.memberships(project_id,user_id) on delete cascade
);
create index grants_user on public.document_grants(user_id,document_id);
create table public.tasks (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects on delete restrict,
 body text not null check(length(btrim(body)) between 1 and 2000), completed boolean not null default false,
 due_date date, deleted_at timestamptz, created_by uuid not null references public.profiles on delete restrict,
 request_id uuid not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 revision int not null default 1 check(revision>0), unique(created_by,request_id)
);
create index tasks_project on public.tasks(project_id,completed,created_at desc) where deleted_at is null;
create table public.diary_entries (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects on delete restrict,
 work_date date not null, body text not null check(length(btrim(body)) between 1 and 20000),
 reporter_id uuid not null references public.profiles on delete restrict, reporter_name text not null,
 entered_at timestamptz not null default now(), edited_at timestamptz, edited_by_name text,
 cancelled_at timestamptz, cancelled_by uuid references public.profiles on delete restrict,
 request_id uuid not null, revision int not null default 1 check(revision>0), unique(reporter_id,request_id),
 check((cancelled_at is null)=(cancelled_by is null))
);
create index diary_project on public.diary_entries(project_id,work_date desc,entered_at desc,id desc) where cancelled_at is null;
create index diary_general on public.diary_entries(work_date desc,entered_at desc,id desc) where cancelled_at is null;
create table public.diary_versions (
 entry_id uuid not null references public.diary_entries on delete restrict, version int not null check(version>0),
 kind public.version_kind not null, project_id uuid not null references public.projects on delete restrict,
 work_date date not null, body text not null, cancelled boolean not null, reporter_name text not null,
 editor_id uuid not null references public.profiles on delete restrict, editor_name text not null,
 created_at timestamptz not null default now(), primary key(entry_id,version)
);
create index versions_project on public.diary_versions(project_id,entry_id);
create table public.diary_attachments (
 id uuid primary key default gen_random_uuid(), entry_id uuid not null references public.diary_entries on delete restrict,
 file_id uuid not null unique references public.stored_files on delete restrict,
 created_at timestamptz not null default now(), unique(id,entry_id)
);
create table public.diary_version_files (
 entry_id uuid not null, version int not null, attachment_id uuid not null,
 position smallint not null check(position between 1 and 20), primary key(entry_id,version,attachment_id),
 unique(entry_id,version,position),
 foreign key(entry_id,version) references public.diary_versions(entry_id,version) on delete restrict,
 foreign key(attachment_id,entry_id) references public.diary_attachments(id,entry_id) on delete restrict
);
create index version_files_attachment on public.diary_version_files(attachment_id);
create table public.transactions (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects on delete restrict,
 year smallint not null check(year between 2000 and 2100), month smallint not null check(month between 1 and 12),
 day smallint, kind public.transaction_kind not null, amount bigint not null check(amount between 1 and 100000000000),
 details text not null check(length(btrim(details)) between 1 and 500), position bigint generated always as identity,
 cancelled_at timestamptz, cancelled_by uuid references public.profiles on delete restrict,
 created_by uuid not null references public.profiles on delete restrict,
 updated_by uuid not null references public.profiles on delete restrict, request_id uuid not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 revision int not null default 1 check(revision>0), unique(created_by,request_id),
 check((cancelled_at is null)=(cancelled_by is null)),
 check(day is null or (day>=1 and day<=extract(day from (make_date(year,month,1)+interval '1 month - 1 day'))))
);
create index transactions_project on public.transactions(project_id,year,month,position) where cancelled_at is null;
create index transactions_month on public.transactions(year,month,project_id) where cancelled_at is null;
create table public.sensitive_events (
 id bigint generated always as identity primary key, occurred_at timestamptz not null default now(),
 actor_id uuid references public.profiles on delete restrict, actor_label text not null,
 action text not null check(action in ('user.created','user.updated','user.active_changed','user.password_reset',
 'membership.changed','membership.removed','membership.finance_changed','project.created','project.updated',
 'project.status_changed','project.archive_changed','project.cover_changed','document.created','document.replaced',
 'document.access_changed','document.archive_changed','task.deleted','entry.corrected','entry.moved','entry.cancelled',
 'transaction.created','transaction.updated','transaction.cancelled','finance.link_changed','owner.created','owner.password_recovered')),
 entity_type text not null, entity_id text not null, project_id uuid references public.projects on delete restrict,
 before jsonb, after jsonb
);
create index events_time on public.sensitive_events(occurred_at desc,id desc);
create index events_project on public.sensitive_events(project_id,occurred_at desc);

-- All API roles start without write, sequence or function privileges.
revoke all on all tables in schema public from anon, authenticated, service_role;
revoke all on all sequences in schema public from anon, authenticated, service_role;
revoke all on all functions in schema public from public, anon, authenticated, service_role;

create function private.active() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join auth.sessions s on s.user_id=p.id
 where p.id=auth.uid() and p.is_active and s.id::text=auth.jwt()->>'session_id'
 and s.created_at>=p.sessions_valid_after)
$$;
create function private.owner() returns boolean language sql stable security definer set search_path='' as $$
 select private.active() and exists(select 1 from public.profiles where id=auth.uid() and is_owner)
$$;
create function private.role_in(p uuid) returns public.project_role language sql stable security definer set search_path='' as $$
 select role from public.memberships where project_id=p and user_id=auth.uid() and private.active()
$$;
create function private.member(p uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.owner() or private.role_in(p) is not null
$$;
create function private.manager(p uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.owner() or coalesce(private.role_in(p)='manager',false)
$$;
create function private.writable(p uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.owner() or exists(select 1 from public.projects where id=p and status='active' and archived_at is null)
$$;
create function private.work(p uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.member(p) and private.writable(p)
$$;
create function private.manage(p uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.manager(p) and private.writable(p)
$$;
create function private.finance(p uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.owner() or (private.active() and exists(select 1 from public.memberships
 where project_id=p and user_id=auth.uid() and role='manager' and finance_access))
$$;
create function private.finance_write(p uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.finance(p) and private.writable(p)
$$;
create function private.read_document(d uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.documents x where x.id=d and (private.owner() or
 (private.member(x.project_id) and x.archived_at is null and (x.access='all' or
 (x.access='selected' and exists(select 1 from public.document_grants g where g.document_id=d and g.user_id=auth.uid()))))))
$$;
create function private.read_entry(e uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.diary_entries x where x.id=e and
 (private.owner() or (private.member(x.project_id) and x.cancelled_at is null)))
$$;
create function private.read_version(e uuid,v int) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.diary_versions x join public.diary_entries y on y.id=x.entry_id
 where x.entry_id=e and x.version=v and (private.owner() or
 (private.read_entry(e) and x.project_id=y.project_id)))
$$;
create function private.correct_entry_allowed(e uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.diary_entries x where x.id=e and x.cancelled_at is null and
 (private.owner() or (x.reporter_id=auth.uid() and private.work(x.project_id))))
$$;
create function private.read_file(f uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.active() and exists(select 1 from public.stored_files x where x.id=f and x.state='ready' and
 (private.owner() or exists(select 1 from public.project_covers c where c.file_id=f and c.is_active and private.member(c.project_id))
 or exists(select 1 from public.documents d where d.file_id=f and private.read_document(d.id))
 or exists(select 1 from public.diary_attachments a join public.diary_version_files v on v.attachment_id=a.id
 where a.file_id=f and private.read_version(v.entry_id,v.version))))
$$;

create function private.fail(code text, field text default null) returns void language plpgsql set search_path='' as $$
begin
 raise exception using errcode='P0001',message=code,detail=jsonb_build_object('code',code,'field',field)::text;
end $$;
create function private.require_active() returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.active() then perform private.fail('UNAUTHENTICATED'); end if;
 -- Prevent revocation racing a write after its authorization check.
 perform 1 from public.profiles where id=auth.uid() for share;
 if not private.active() then perform private.fail('UNAUTHENTICATED'); end if;
end $$;
create function private.require_owner() returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_active();
 if not private.owner() then perform private.fail('FORBIDDEN'); end if;
end $$;
create function private.require_project(p uuid, permission text, writing boolean default true) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_active();
 perform 1 from public.projects where id=p for share;
 if not found or not private.member(p) then perform private.fail('NOT_FOUND'); end if;
 perform 1 from public.memberships where project_id=p and user_id=auth.uid() for share;
 if not private.member(p) then perform private.fail('NOT_FOUND'); end if;
 if permission='manager' and not private.manager(p) then perform private.fail('FORBIDDEN'); end if;
 if permission='finance' and not private.finance(p) then perform private.fail('NOT_FOUND'); end if;
 if writing and not private.writable(p) then perform private.fail('PROJECT_READ_ONLY'); end if;
end $$;
create function private.keys(input jsonb, allowed text[], required text[] default '{}') returns void language plpgsql set search_path='' as $$
declare k text; v jsonb; expected text;
begin
 if input is null or jsonb_typeof(input)<>'object' or exists(select 1 from jsonb_object_keys(input) k where not k=any(allowed))
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
create function private.revision(actual int, expected jsonb) returns void language plpgsql set search_path='' as $$
begin
 if jsonb_typeof(expected) is distinct from 'number' or expected::text !~ '^[1-9][0-9]*$' then perform private.fail('VALIDATION','expectedRevision'); end if;
 if actual<>(expected::text)::int then perform private.fail('CONFLICT'); end if;
end $$;
create function private.saved(id uuid,revision int) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',id,'revision',revision)
$$;
create function private.audit(action text, entity text, id text, project uuid default null, old_value jsonb default null, new_value jsonb default null)
 returns void language sql security definer set search_path='' as $$
 insert into public.sensitive_events(actor_id,actor_label,action,entity_type,entity_id,project_id,before,after)
 select auth.uid(),full_name,action,entity,id,project,old_value,new_value from public.profiles where profiles.id=auth.uid()
$$;
create function private.request_lock(kind text,request uuid) returns void language plpgsql set search_path='' as $$
begin
 if request is null then perform private.fail('VALIDATION','requestId'); end if;
 perform pg_advisory_xact_lock(hashtextextended(kind||auth.uid()::text||request::text,0));
end $$;

create function private.immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='DELETE' then perform private.fail('FORBIDDEN'); end if;
 if TG_TABLE_NAME in ('diary_versions','diary_version_files','diary_attachments','sensitive_events') then perform private.fail('FORBIDDEN'); end if;
 if TG_TABLE_NAME='stored_files' and (to_jsonb(old)->>'state'<>'pending' or to_jsonb(new)->>'state'='pending'
 or (to_jsonb(new)-array['state','mime','size_bytes','sha256','ready_at','display_path','display_state'])
 is distinct from (to_jsonb(old)-array['state','mime','size_bytes','sha256','ready_at','display_path','display_state'])) then perform private.fail('FORBIDDEN'); end if;
 if TG_TABLE_NAME='diary_entries' and (to_jsonb(old)->>'cancelled_at' is not null or
 (to_jsonb(new)->'reporter_id') is distinct from (to_jsonb(old)->'reporter_id') or
 (to_jsonb(new)->'reporter_name') is distinct from (to_jsonb(old)->'reporter_name') or
 (to_jsonb(new)->'entered_at') is distinct from (to_jsonb(old)->'entered_at')) then perform private.fail('FORBIDDEN'); end if;
 if TG_TABLE_NAME='transactions' and (to_jsonb(old)->>'cancelled_at' is not null or to_jsonb(new)->'project_id' is distinct from to_jsonb(old)->'project_id' or to_jsonb(new)->'position' is distinct from to_jsonb(old)->'position') then perform private.fail('FORBIDDEN'); end if;
 return new;
end $$;
create trigger immutable_diary_versions before update or delete on public.diary_versions for each row execute function private.immutable();
create trigger immutable_diary_version_files before update or delete on public.diary_version_files for each row execute function private.immutable();
create trigger immutable_diary_attachments before update or delete on public.diary_attachments for each row execute function private.immutable();
create trigger immutable_sensitive_events before update or delete on public.sensitive_events for each row execute function private.immutable();
create trigger immutable_diary_entries before update or delete on public.diary_entries for each row execute function private.immutable();
create trigger immutable_stored_files before update or delete on public.stored_files for each row execute function private.immutable();
create trigger immutable_transactions before update or delete on public.transactions for each row execute function private.immutable();

create function public.create_profile(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.profiles; u auth.users;
begin

perform private.require_owner(); perform private.keys(input,array['email','fullName']::text[],array['email','fullName']::text[]);
select * into u from auth.users where lower(email)=lower(btrim(input->>'email'));
if not found then perform private.fail('NOT_FOUND'); end if;
perform pg_advisory_xact_lock(hashtextextended(u.id::text,1));
select * into r from public.profiles where id=u.id;
if found then perform private.fail('CONFLICT'); end if;
insert into public.profiles(id,email,full_name,created_by) values(u.id,lower(u.email),btrim(input->>'fullName'),auth.uid()) returning * into r;
perform private.audit('user.created','profile',r.id::text);
return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.update_profile(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.profiles; old_value jsonb;
begin

perform private.require_owner(); perform private.keys(input,array['id','expectedRevision','fullName','email']::text[],array['id','expectedRevision','fullName','email']::text[]);
select * into r from public.profiles where id=(input->>'id')::uuid for update;
if not found then perform private.fail('NOT_FOUND'); end if;
perform private.revision(r.revision,input->'expectedRevision');
if not exists(select 1 from auth.users where id=r.id and lower(email)=lower(btrim(input->>'email'))) then perform private.fail('VALIDATION','email'); end if;
update public.profiles set full_name=btrim(input->>'fullName'),email=lower(btrim(input->>'email')),revision=revision+1,updated_at=now() where id=r.id returning * into r;
perform private.audit('user.updated','profile',r.id::text);
return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.set_user_active(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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

create function public.revoke_user_sessions(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.profiles; old_active boolean;
begin

perform private.require_owner(); perform private.keys(input,array['id']::text[],array['id']::text[]);
select * into r from public.profiles where id=(input->>'id')::uuid for update;
if not found then perform private.fail('NOT_FOUND'); end if;

old_active:=r.is_active;
update public.profiles set  sessions_valid_after=clock_timestamp(),revision=revision+1,updated_at=now() where id=r.id returning * into r;
perform private.audit('user.password_reset','profile',r.id::text,null,jsonb_build_object('active',old_active),jsonb_build_object('active',r.is_active));
return 'null'::jsonb;
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.set_membership(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.memberships; u public.profiles; old_value jsonb;
begin
perform private.require_owner(); perform private.keys(input,array['userId','projectId','role','expectedRevision']::text[],array['userId','projectId','role','expectedRevision']::text[]);
perform 1 from public.projects where id=(input->>'projectId')::uuid for update;
if not found then perform private.fail('NOT_FOUND'); end if;
select * into u from public.profiles where id=(input->>'userId')::uuid for share;
if not found then perform private.fail('NOT_FOUND'); end if;
select * into r from public.memberships where project_id=(input->>'projectId')::uuid and user_id=u.id for update;
old_value:=to_jsonb(r);
if not u.is_active or u.is_owner then perform private.fail('FORBIDDEN'); end if;
if r.user_id is null then
 if input->'expectedRevision'<>'null'::jsonb then perform private.fail('CONFLICT'); end if;
 insert into public.memberships(project_id,user_id,role) values((input->>'projectId')::uuid,u.id,(input->>'role')::public.project_role) returning * into r;
else
 perform private.revision(r.revision,input->'expectedRevision');
 update public.memberships set role=(input->>'role')::public.project_role,
 finance_access=case when input->>'role'='worker' then false else finance_access end,
 revision=revision+1,updated_at=now() where project_id=r.project_id and user_id=r.user_id returning * into r;
end if;
perform private.audit('membership.changed','membership',u.id::text,r.project_id,old_value,to_jsonb(r));
return jsonb_build_object('revision',r.revision,'financeAccess',r.finance_access);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.remove_membership(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.memberships; u public.profiles; old_value jsonb;
begin
perform private.require_owner(); perform private.keys(input,array['userId','projectId','expectedRevision']::text[],array['userId','projectId','expectedRevision']::text[]);
perform 1 from public.projects where id=(input->>'projectId')::uuid for update;
if not found then perform private.fail('NOT_FOUND'); end if;
select * into u from public.profiles where id=(input->>'userId')::uuid for share;
if not found then perform private.fail('NOT_FOUND'); end if;
select * into r from public.memberships where project_id=(input->>'projectId')::uuid and user_id=u.id for update;
old_value:=to_jsonb(r);
if r.user_id is null then perform private.fail('NOT_FOUND'); end if; perform private.revision(r.revision,input->'expectedRevision');
delete from public.memberships where project_id=r.project_id and user_id=r.user_id;
perform private.audit('membership.removed','membership',u.id::text,r.project_id,old_value,null);
return 'null'::jsonb;
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.set_finance_access(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.memberships; u public.profiles; old_value jsonb;
begin
perform private.require_owner(); perform private.keys(input,array['userId','projectId','enabled','expectedRevision']::text[],array['userId','projectId','enabled','expectedRevision']::text[]);
perform 1 from public.projects where id=(input->>'projectId')::uuid for update;
if not found then perform private.fail('NOT_FOUND'); end if;
select * into u from public.profiles where id=(input->>'userId')::uuid for share;
if not found then perform private.fail('NOT_FOUND'); end if;
select * into r from public.memberships where project_id=(input->>'projectId')::uuid and user_id=u.id for update;
old_value:=to_jsonb(r);
if r.user_id is null then perform private.fail('NOT_FOUND'); end if; perform private.revision(r.revision,input->'expectedRevision');
if jsonb_typeof(input->'enabled')<>'boolean' then perform private.fail('VALIDATION'); end if; update public.memberships set finance_access=(input->>'enabled')::boolean,revision=revision+1,updated_at=now() where project_id=r.project_id and user_id=r.user_id returning * into r;
perform private.audit('membership.finance_changed','membership',u.id::text,r.project_id,old_value,to_jsonb(r));
return jsonb_build_object('revision',r.revision,'financeAccess',r.finance_access);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.create_project(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.projects; f jsonb;
begin
perform private.require_owner(); perform private.keys(input,array['requestId','fields']::text[],array['requestId','fields']::text[]);
perform private.request_lock('project',(input->>'requestId')::uuid); select * into r from public.projects where created_by=auth.uid() and request_id=(input->>'requestId')::uuid; if found then return private.saved(r.id,r.revision); end if;
f:=input->'fields'; perform private.keys(f,array['name', 'businessName', 'siteAddress', 'contact', 'startDate', 'endDate', 'accessNotes', 'businessNumber']::text[],array['name', 'businessName', 'siteAddress', 'contact', 'startDate', 'endDate', 'accessNotes']::text[]);
perform private.keys(f->'contact',array['name','phone','email','roleTitle'],array['name','phone','email','roleTitle']); if f ? 'businessNumber' and not private.owner() then perform private.fail('FORBIDDEN'); end if;
insert into public.projects(name,business_name,site_address,access_notes,start_date,end_date,created_by,request_id) values(btrim(f->>'name'),btrim(f->>'businessName'),btrim(f->>'siteAddress'),f->>'accessNotes',(f->>'startDate')::date,(f->>'endDate')::date,auth.uid(),(input->>'requestId')::uuid) returning * into r;
insert into public.project_contacts(project_id,name,phone,email,role_title) values(r.id,btrim(f->'contact'->>'name'),btrim(f->'contact'->>'phone'),f->'contact'->>'email',f->'contact'->>'roleTitle')
 on conflict(project_id) do update set name=excluded.name,phone=excluded.phone,email=excluded.email,role_title=excluded.role_title;
 if private.owner() then insert into public.project_private(project_id,business_number) values(r.id,f->>'businessNumber') on conflict(project_id) do update set business_number=excluded.business_number; end if;
insert into public.project_finance_settings(project_id) values(r.id);
perform private.audit('project.created','project',r.id::text,r.id,null,jsonb_build_object('fields',(select jsonb_agg(k) from jsonb_object_keys(f) k))); return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.update_project(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.projects; f jsonb;
begin
perform private.require_active(); perform private.keys(input,array['id','expectedRevision','fields']::text[],array['id','expectedRevision','fields']::text[]);
select * into r from public.projects where id=(input->>'id')::uuid for update; if not found then perform private.fail('NOT_FOUND'); end if; perform private.require_project(r.id,'manager'); perform private.revision(r.revision,input->'expectedRevision');
f:=input->'fields'; perform private.keys(f,array['name', 'businessName', 'siteAddress', 'contact', 'startDate', 'endDate', 'accessNotes', 'businessNumber']::text[],array['name', 'businessName', 'siteAddress', 'contact', 'startDate', 'endDate', 'accessNotes']::text[]);
perform private.keys(f->'contact',array['name','phone','email','roleTitle'],array['name','phone','email','roleTitle']); if f ? 'businessNumber' and not private.owner() then perform private.fail('FORBIDDEN'); end if;
update public.projects set name=btrim(f->>'name'),business_name=btrim(f->>'businessName'),site_address=btrim(f->>'siteAddress'),access_notes=f->>'accessNotes',start_date=(f->>'startDate')::date,end_date=(f->>'endDate')::date,revision=revision+1,updated_at=now() where id=r.id returning * into r;
insert into public.project_contacts(project_id,name,phone,email,role_title) values(r.id,btrim(f->'contact'->>'name'),btrim(f->'contact'->>'phone'),f->'contact'->>'email',f->'contact'->>'roleTitle')
 on conflict(project_id) do update set name=excluded.name,phone=excluded.phone,email=excluded.email,role_title=excluded.role_title;
 if private.owner() then insert into public.project_private(project_id,business_number) values(r.id,f->>'businessNumber') on conflict(project_id) do update set business_number=excluded.business_number; end if;
perform private.audit('project.updated','project',r.id::text,r.id,null,jsonb_build_object('fields',(select jsonb_agg(k) from jsonb_object_keys(f) k))); return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.set_project_status(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.projects; old_value jsonb;
begin
perform private.require_owner(); perform private.keys(input,array['id','expectedRevision','status']::text[],array['id','expectedRevision','status']::text[]);
 select * into r from public.projects where id=(input->>'id')::uuid for update;
 if not found then perform private.fail('NOT_FOUND'); end if;
 perform private.revision(r.revision,input->'expectedRevision'); old_value:=to_jsonb(r.status);
 update public.projects set status=(input->>'status')::public.project_status,revision=revision+1,updated_at=now() where id=r.id returning * into r;
 perform private.audit('project.status_changed','project',r.id::text,r.id,old_value,to_jsonb(r.status));
 return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.set_project_archived(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.projects; old_value jsonb;
begin
perform private.require_owner(); perform private.keys(input,array['id','expectedRevision','archived']::text[],array['id','expectedRevision','archived']::text[]);
 select * into r from public.projects where id=(input->>'id')::uuid for update;
 if not found then perform private.fail('NOT_FOUND'); end if;
 perform private.revision(r.revision,input->'expectedRevision'); old_value:=to_jsonb(r.archived_at is not null);
 update public.projects set archived_at=case when (input->>'archived')::boolean then now() else null end,revision=revision+1,updated_at=now() where id=r.id returning * into r;
 perform private.audit('project.archive_changed','project',r.id::text,r.id,old_value,to_jsonb(r.archived_at is not null));
 return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.create_task(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.tasks;
begin
perform private.require_active(); perform private.keys(input,array['requestId','projectId','body','dueDate','completed']::text[],array['requestId','projectId','body','dueDate','completed']::text[]);
perform private.require_project((input->>'projectId')::uuid,'member'); perform private.request_lock('task',(input->>'requestId')::uuid); select * into r from public.tasks where created_by=auth.uid() and request_id=(input->>'requestId')::uuid; if found then perform private.require_project(r.project_id,'member'); return private.saved(r.id,r.revision); end if;
 insert into public.tasks(project_id,body,due_date,completed,created_by,request_id) values((input->>'projectId')::uuid,btrim(input->>'body'),(input->>'dueDate')::date,(input->>'completed')::boolean,auth.uid(),(input->>'requestId')::uuid) returning * into r;
return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.update_task(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.tasks;
begin
perform private.require_active(); perform private.keys(input,array['id','expectedRevision','body','dueDate']::text[],array['id','expectedRevision','body','dueDate']::text[]);
select * into r from public.tasks where id=(input->>'id')::uuid and deleted_at is null for update; if not found then perform private.fail('NOT_FOUND'); end if; perform private.require_project(r.project_id,'member'); perform private.revision(r.revision,input->'expectedRevision');
update public.tasks set body=btrim(input->>'body'),due_date=(input->>'dueDate')::date,revision=revision+1,updated_at=now() where id=r.id returning * into r;
return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.set_task_completed(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.tasks;
begin
perform private.require_active(); perform private.keys(input,array['id','expectedRevision','completed']::text[],array['id','expectedRevision','completed']::text[]);
select * into r from public.tasks where id=(input->>'id')::uuid and deleted_at is null for update; if not found then perform private.fail('NOT_FOUND'); end if; perform private.require_project(r.project_id,'member'); perform private.revision(r.revision,input->'expectedRevision');
update public.tasks set completed=(input->>'completed')::boolean,revision=revision+1,updated_at=now() where id=r.id returning * into r;
return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.delete_task(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.tasks;
begin
perform private.require_owner(); perform private.keys(input,array['id','expectedRevision']::text[],array['id','expectedRevision']::text[]);
select * into r from public.tasks where id=(input->>'id')::uuid and deleted_at is null for update; if not found then perform private.fail('NOT_FOUND'); end if; perform private.require_project(r.project_id,'member'); perform private.revision(r.revision,input->'expectedRevision');
update public.tasks set deleted_at=now(),revision=revision+1,updated_at=now() where id=r.id returning * into r;
perform private.audit('task.deleted','task',r.id::text,r.project_id); return 'null'::jsonb;
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function private.claim_file(f uuid,p uuid,purpose public.file_purpose) returns void language plpgsql security definer set search_path='' as $$
declare r public.stored_files;
begin
 select * into r from public.stored_files where id=f for update;
 if not found or r.uploaded_by<>auth.uid() or r.project_id<>p or r.purpose<>purpose or r.state<>'ready'
 then perform private.fail('NOT_FOUND'); end if;
 if exists(select 1 from public.documents where file_id=f) or exists(select 1 from public.project_covers where file_id=f)
 or exists(select 1 from public.diary_attachments where file_id=f) then perform private.fail('CONFLICT'); end if;
end $$;
create function private.document_access(d uuid,p uuid,a jsonb) returns void language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 perform private.keys(a,array['mode','userIds'],array['mode']);
 if a->>'mode' not in ('owner','all','selected') or a->>'mode' is null then perform private.fail('VALIDATION','access'); end if;
 if a->>'mode'='selected' then
  if jsonb_typeof(a->'userIds') is distinct from 'array' or jsonb_array_length(a->'userIds')=0 then perform private.fail('VALIDATION','userIds'); end if;
  for u in select value::uuid from jsonb_array_elements_text(a->'userIds') loop
   perform 1 from public.memberships m join public.profiles x on x.id=m.user_id where m.project_id=p and m.user_id=u and x.is_active for share of m,x;
   if not found then perform private.fail('VALIDATION','userIds'); end if;
  end loop;
 elsif a ? 'userIds' then perform private.fail('VALIDATION','userIds'); end if;
 delete from public.document_grants where document_id=d;
 if a->>'mode'='selected' then
  insert into public.document_grants(document_id,project_id,user_id) select d,p,value::uuid from jsonb_array_elements_text(a->'userIds') on conflict do nothing;
 end if;
end $$;
create function private.snapshot_entry(e uuid,k public.version_kind,files jsonb) returns void language plpgsql security definer set search_path='' as $$
declare r public.diary_entries; f uuid; a uuid; pos int:=0;
begin
 select * into r from public.diary_entries where id=e;
 if jsonb_typeof(files) is distinct from 'array' or jsonb_array_length(files)>20 then perform private.fail('LIMIT','fileIds'); end if;
 insert into public.diary_versions(entry_id,version,kind,project_id,work_date,body,cancelled,reporter_name,editor_id,editor_name)
 select r.id,r.revision,k,r.project_id,r.work_date,r.body,r.cancelled_at is not null,r.reporter_name,auth.uid(),full_name from public.profiles where id=auth.uid();
 for f in select value::uuid from jsonb_array_elements_text(files) loop
  pos:=pos+1;
  select id into a from public.diary_attachments where entry_id=e and file_id=f;
  if not found then
   perform private.claim_file(f,r.project_id,'diary');
   insert into public.diary_attachments(entry_id,file_id) values(e,f) returning id into a;
  end if;
  insert into public.diary_version_files(entry_id,version,attachment_id,position) values(e,r.revision,a,pos);
 end loop;
end $$;

create function public.begin_upload(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p uuid; f jsonb; r public.stored_files; result jsonb:='[]'; purpose public.file_purpose;
begin

perform private.require_active(); perform private.keys(input,array['projectId','purpose','files']::text[],array['projectId','purpose','files']::text[]);
p:=(input->>'projectId')::uuid; purpose:=(input->>'purpose')::public.file_purpose;
if purpose='cover' then perform private.require_owner(); end if;
perform private.require_project(p,case when purpose='document' then 'manager' else 'member' end);
if jsonb_typeof(input->'files') is distinct from 'array' or jsonb_array_length(input->'files') not between 1 and 20 then perform private.fail('LIMIT','files'); end if;
for f in select value from jsonb_array_elements(input->'files') loop
 perform private.keys(f,array['clientId','name','mime','sizeBytes'],array['clientId','name','mime','sizeBytes']);
 if f->>'mime' not in ('application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif') or (purpose='cover' and f->>'mime'='application/pdf') then perform private.fail('LIMIT','mime'); end if;
 if (f->>'sizeBytes')::bigint not between 1 and (case when purpose='document' then 52428800 else 26214400 end) then perform private.fail('LIMIT','sizeBytes'); end if;
 r.id:=gen_random_uuid();
 insert into public.stored_files(id,purpose,project_id,uploaded_by,original_name,bucket,object_path,declared_mime,declared_size)
 values(r.id,purpose,p,auth.uid(),f->>'name','originals',p::text||'/'||r.id::text,f->>'mime',(f->>'sizeBytes')::bigint) returning * into r;
 result:=result||jsonb_build_array(jsonb_build_object('clientId',(f->>'clientId')::uuid,'fileId',r.id,'bucket',r.bucket,'path',r.object_path));
end loop;
return result;
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.set_project_cover(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.projects;
begin

perform private.require_owner(); perform private.keys(input,array['id','expectedRevision','fileId']::text[],array['id','expectedRevision','fileId']::text[]);
select * into r from public.projects where id=(input->>'id')::uuid for update;
if not found then perform private.fail('NOT_FOUND'); end if;
perform private.revision(r.revision,input->'expectedRevision'); perform private.claim_file((input->>'fileId')::uuid,r.id,'cover');
update public.project_covers set is_active=false where project_id=r.id and is_active;
insert into public.project_covers(project_id,file_id,created_by) values(r.id,(input->>'fileId')::uuid,auth.uid());
update public.projects set revision=revision+1,updated_at=now() where id=r.id returning * into r;
perform private.audit('project.cover_changed','project',r.id::text,r.id);
return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.create_document(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.documents; p uuid; replaced public.documents;
begin

perform private.require_active(); perform private.keys(input,array['projectId','fileId','category','access','replacesDocumentId']::text[],array['projectId','fileId','category','access']::text[]);
p:=(input->>'projectId')::uuid; perform private.require_project(p,'manager');
if input ? 'replacesDocumentId' then
 perform private.require_owner();
 select * into replaced from public.documents where id=(input->>'replacesDocumentId')::uuid and project_id=p for update;
 if not found then perform private.fail('NOT_FOUND'); end if;
end if;
perform private.claim_file((input->>'fileId')::uuid,p,'document');
insert into public.documents(project_id,file_id,category,access,uploaded_by,uploaded_by_name,replaces_document_id)
select p,(input->>'fileId')::uuid,(input->>'category')::public.document_category,(input->'access'->>'mode')::public.document_access,
 auth.uid(),full_name,replaced.id from public.profiles where id=auth.uid() returning * into r;
perform private.document_access(r.id,p,input->'access');
if replaced.id is not null then
 update public.documents set archived_at=now(),revision=revision+1 where id=replaced.id;
 perform private.audit('document.replaced','document',replaced.id::text,p,null,jsonb_build_object('replacementId',r.id));
end if;
perform private.audit('document.created','document',r.id::text,p,null,input->'access');
return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.set_document_access(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.documents; old_value jsonb;
begin

perform private.require_owner(); perform private.keys(input,array['id','expectedRevision','access']::text[],array['id','expectedRevision','access']::text[]);
select * into r from public.documents where id=(input->>'id')::uuid for update;
if not found then perform private.fail('NOT_FOUND'); end if;
perform private.revision(r.revision,input->'expectedRevision');
old_value:=jsonb_build_object('access',r.access,'archived',r.archived_at is not null,'userIds',(select jsonb_agg(user_id) from public.document_grants where document_id=r.id));
perform private.document_access(r.id,r.project_id,input->'access');
update public.documents set access=(input->'access'->>'mode')::public.document_access,revision=revision+1 where id=r.id returning * into r;
perform private.audit('document.access_changed','document',r.id::text,r.project_id,old_value,input->'access');
return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.set_document_archived(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.documents; old_value jsonb;
begin

perform private.require_owner(); perform private.keys(input,array['id','expectedRevision','archived']::text[],array['id','expectedRevision','archived']::text[]);
select * into r from public.documents where id=(input->>'id')::uuid for update;
if not found then perform private.fail('NOT_FOUND'); end if;
perform private.revision(r.revision,input->'expectedRevision');
old_value:=jsonb_build_object('access',r.access,'archived',r.archived_at is not null,'userIds',(select jsonb_agg(user_id) from public.document_grants where document_id=r.id));

update public.documents set archived_at=case when (input->>'archived')::boolean then now() else null end,revision=revision+1 where id=r.id returning * into r;
perform private.audit('document.archive_changed','document',r.id::text,r.project_id,old_value,input->'archived');
return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.create_entry(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.diary_entries; files jsonb; old_project uuid;
begin
perform private.require_active(); perform private.keys(input,array['requestId','projectId','workDate','body','fileIds']::text[],array['requestId','projectId','workDate','body','fileIds']::text[]);
perform private.require_project((input->>'projectId')::uuid,'member'); perform private.request_lock('entry',(input->>'requestId')::uuid); select * into r from public.diary_entries where reporter_id=auth.uid() and request_id=(input->>'requestId')::uuid; if found then if not private.read_entry(r.id) then perform private.fail('NOT_FOUND'); end if; return private.saved(r.id,r.revision); end if;
if (input->>'workDate')::date>(now() at time zone 'Asia/Jerusalem')::date then perform private.fail('VALIDATION','workDate'); end if;
insert into public.diary_entries(project_id,work_date,body,reporter_id,reporter_name,request_id) select (input->>'projectId')::uuid,(input->>'workDate')::date,btrim(input->>'body'),auth.uid(),full_name,(input->>'requestId')::uuid from public.profiles where id=auth.uid() returning * into r;
perform private.snapshot_entry(r.id,'created',input->'fileIds');
return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.correct_entry(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.diary_entries; files jsonb; old_project uuid;
begin
perform private.require_active(); perform private.keys(input,array['id','expectedRevision','body','fileIds']::text[],array['id','expectedRevision','body','fileIds']::text[]);
select * into r from public.diary_entries where id=(input->>'id')::uuid for update; if not found or not private.read_entry(r.id) then perform private.fail('NOT_FOUND'); end if; perform private.require_project(r.project_id,'member'); if r.cancelled_at is not null then perform private.fail('CONFLICT'); end if;
if not private.correct_entry_allowed(r.id) then perform private.fail('FORBIDDEN'); end if;
perform private.revision(r.revision,input->'expectedRevision');
old_project:=r.project_id; select coalesce(jsonb_agg(a.file_id order by v.position),'[]') into files from public.diary_version_files v join public.diary_attachments a on a.id=v.attachment_id where v.entry_id=r.id and v.version=r.revision;
update public.diary_entries set body=btrim(input->>'body'),edited_at=now(),edited_by_name=(select full_name from public.profiles where id=auth.uid()),revision=revision+1 where id=r.id returning * into r;
perform private.snapshot_entry(r.id,'corrected',input->'fileIds');
perform private.audit('entry.corrected','entry',r.id::text,r.project_id,jsonb_build_object('projectId',old_project),jsonb_build_object('projectId',r.project_id,'revision',r.revision));
return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.move_entry(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.diary_entries; files jsonb; old_project uuid;
begin
perform private.require_owner(); perform private.keys(input,array['id','expectedRevision','projectId','workDate']::text[],array['id','expectedRevision','projectId','workDate']::text[]);
select * into r from public.diary_entries where id=(input->>'id')::uuid for update; if not found or not private.read_entry(r.id) then perform private.fail('NOT_FOUND'); end if; perform private.require_project(r.project_id,'member'); if r.cancelled_at is not null then perform private.fail('CONFLICT'); end if;
perform private.revision(r.revision,input->'expectedRevision');
if (input->>'workDate')::date>(now() at time zone 'Asia/Jerusalem')::date then perform private.fail('VALIDATION','workDate'); end if;
old_project:=r.project_id; select coalesce(jsonb_agg(a.file_id order by v.position),'[]') into files from public.diary_version_files v join public.diary_attachments a on a.id=v.attachment_id where v.entry_id=r.id and v.version=r.revision;
perform private.require_project((input->>'projectId')::uuid,'member');
update public.diary_entries set project_id=(input->>'projectId')::uuid,work_date=(input->>'workDate')::date,edited_at=now(),edited_by_name=(select full_name from public.profiles where id=auth.uid()),revision=revision+1 where id=r.id returning * into r;
perform private.snapshot_entry(r.id,'moved',files);
perform private.audit('entry.moved','entry',r.id::text,r.project_id,jsonb_build_object('projectId',old_project),jsonb_build_object('projectId',r.project_id,'revision',r.revision));
return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.cancel_entry(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.diary_entries; files jsonb; old_project uuid;
begin
perform private.require_owner(); perform private.keys(input,array['id','expectedRevision']::text[],array['id','expectedRevision']::text[]);
select * into r from public.diary_entries where id=(input->>'id')::uuid for update; if not found or not private.read_entry(r.id) then perform private.fail('NOT_FOUND'); end if; perform private.require_project(r.project_id,'member'); if r.cancelled_at is not null then perform private.fail('CONFLICT'); end if;
perform private.revision(r.revision,input->'expectedRevision');
old_project:=r.project_id; select coalesce(jsonb_agg(a.file_id order by v.position),'[]') into files from public.diary_version_files v join public.diary_attachments a on a.id=v.attachment_id where v.entry_id=r.id and v.version=r.revision;
update public.diary_entries set cancelled_at=now(),cancelled_by=auth.uid(),revision=revision+1 where id=r.id returning * into r;
perform private.snapshot_entry(r.id,'cancelled',files);
perform private.audit('entry.cancelled','entry',r.id::text,r.project_id,jsonb_build_object('projectId',old_project),jsonb_build_object('projectId',r.project_id,'revision',r.revision));
return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.create_transaction(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.transactions; f jsonb; old_value jsonb;
begin
perform private.require_active(); perform private.keys(input,array['requestId','projectId','fields']::text[],array['requestId','projectId','fields']::text[]);
perform private.require_project((input->>'projectId')::uuid,'finance'); perform private.request_lock('transaction',(input->>'requestId')::uuid); select * into r from public.transactions where created_by=auth.uid() and request_id=(input->>'requestId')::uuid; if found then perform private.require_project(r.project_id,'finance'); return private.saved(r.id,r.revision); end if;
f:=input->'fields'; perform private.keys(f,array['year','month','day','kind','amount','details'],array['year','month','day','kind','amount','details']);
insert into public.transactions(project_id,year,month,day,kind,amount,details,created_by,updated_by,request_id) values((input->>'projectId')::uuid,(f->>'year')::smallint,(f->>'month')::smallint,(f->>'day')::smallint,(f->>'kind')::public.transaction_kind,(f->>'amount')::bigint,btrim(f->>'details'),auth.uid(),auth.uid(),(input->>'requestId')::uuid) returning * into r;
perform private.audit('transaction.created','transaction',r.id::text,r.project_id,old_value,to_jsonb(r)); return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.update_transaction(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.transactions; f jsonb; old_value jsonb;
begin
perform private.require_active(); perform private.keys(input,array['id','expectedRevision','fields']::text[],array['id','expectedRevision','fields']::text[]);
select * into r from public.transactions where id=(input->>'id')::uuid for update; if not found then perform private.fail('NOT_FOUND'); end if; perform private.require_project(r.project_id,'finance'); if r.cancelled_at is not null then perform private.fail('CONFLICT'); end if; perform private.revision(r.revision,input->'expectedRevision'); old_value:=to_jsonb(r);
f:=input->'fields'; perform private.keys(f,array['year','month','day','kind','amount','details'],array['year','month','day','kind','amount','details']);
update public.transactions set year=(f->>'year')::smallint,month=(f->>'month')::smallint,day=(f->>'day')::smallint,kind=(f->>'kind')::public.transaction_kind,amount=(f->>'amount')::bigint,details=btrim(f->>'details'),revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=r.id returning * into r;
perform private.audit('transaction.updated','transaction',r.id::text,r.project_id,old_value,to_jsonb(r)); return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.cancel_transaction(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.transactions; f jsonb; old_value jsonb;
begin
perform private.require_owner(); perform private.keys(input,array['id','expectedRevision']::text[],array['id','expectedRevision']::text[]);
select * into r from public.transactions where id=(input->>'id')::uuid for update; if not found then perform private.fail('NOT_FOUND'); end if; perform private.require_project(r.project_id,'finance'); if r.cancelled_at is not null then perform private.fail('CONFLICT'); end if; perform private.revision(r.revision,input->'expectedRevision'); old_value:=to_jsonb(r);
update public.transactions set cancelled_at=now(),cancelled_by=auth.uid(),revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=r.id returning * into r;
perform private.audit('transaction.cancelled','transaction',r.id::text,r.project_id,old_value,to_jsonb(r)); return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.set_finance_link(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.project_finance_settings;
begin

perform private.require_active(); perform private.keys(input,array['projectId','url','expectedRevision']::text[],array['projectId','url','expectedRevision']::text[]);
perform private.require_project((input->>'projectId')::uuid,'finance');
select * into r from public.project_finance_settings where project_id=(input->>'projectId')::uuid for update;
if not found then perform private.fail('NOT_FOUND'); end if;
perform private.revision(r.revision,input->'expectedRevision');
update public.project_finance_settings set excel_url=input->>'url',revision=revision+1 where project_id=r.project_id returning * into r;
perform private.audit('finance.link_changed','project',r.project_id::text,r.project_id);
return private.saved(r.project_id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.get_actor(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;
begin
perform private.keys(input,array[]::text[],array[]::text[]);
if not private.active() then return 'null'::jsonb; end if;
select jsonb_build_object('userId',id,'fullName',full_name,'email',email,'isOwner',is_owner) into r from public.profiles where id=auth.uid(); return r;
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.project_permissions(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p uuid;
begin
perform private.require_active(); perform private.keys(input,array['projectId']::text[],array['projectId']::text[]);
p:=(input->>'projectId')::uuid; perform private.require_project(p,'member',false);
return jsonb_build_object('view',true,'editDetails',private.manage(p),'uploadDocument',private.manage(p),'manageAccess',private.owner(),
'writeTasks',private.work(p),'deleteTasks',private.owner(),'report',private.work(p),'viewFinance',private.finance(p),
'writeFinance',private.finance_write(p),'cancelTransaction',private.owner());
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.project_access_candidates(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;
begin
perform private.require_active(); perform private.keys(input,array['projectId']::text[],array['projectId']::text[]);
perform private.require_project((input->>'projectId')::uuid,'manager',false);
select coalesce(jsonb_agg(jsonb_build_object('userId',p.id,'fullName',p.full_name) order by p.full_name,p.id),'[]') into r
from public.memberships m join public.profiles p on p.id=m.user_id where m.project_id=(input->>'projectId')::uuid and p.is_active; return r;
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.project_manager_names(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;
begin
perform private.require_active(); perform private.keys(input,array['projectId']::text[],array['projectId']::text[]);
perform private.require_project((input->>'projectId')::uuid,'member',false);
select coalesce(jsonb_agg(p.full_name order by p.full_name,p.id),'[]') into r from public.memberships m join public.profiles p on p.id=m.user_id
where m.project_id=(input->>'projectId')::uuid and m.role='manager' and p.is_active; return r;
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.get_pending_upload(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.stored_files;
begin
perform private.require_active(); perform private.keys(input,array['fileId']::text[],array['fileId']::text[]);
select * into r from public.stored_files where id=(input->>'fileId')::uuid and uploaded_by=auth.uid() and state='pending';
if not found then perform private.fail('NOT_FOUND'); end if;
perform private.require_project(r.project_id,case when r.purpose='document' then 'manager' else 'member' end);
if r.purpose='cover' then perform private.require_owner(); end if;
return jsonb_build_object('fileId',r.id,'projectId',r.project_id,'uploadedBy',r.uploaded_by,'purpose',r.purpose,'bucket',r.bucket,'path',r.object_path,'name',r.original_name,'declaredMime',r.declared_mime,'declaredSize',r.declared_size);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.authorize_file(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.stored_files; path text;
begin
perform private.require_active(); perform private.keys(input,array['fileId','variant','download']::text[],array['fileId','variant']::text[]);
if not private.read_file((input->>'fileId')::uuid) then perform private.fail('NOT_FOUND'); end if;
if input->>'variant' not in ('original','display') then perform private.fail('VALIDATION'); end if;
select * into r from public.stored_files where id=(input->>'fileId')::uuid;
path:=case when input->>'variant'='display' then r.display_path else r.object_path end;
if path is null then perform private.fail('NOT_FOUND'); end if;
return jsonb_build_object('bucket',case when input->>'variant'='display' then 'display' else r.bucket end,'path',path,'name',r.original_name,'mime',r.mime,'sizeBytes',r.size_bytes);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.project_cards(input jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r jsonb;
begin
perform private.require_active(); perform private.keys(input,array['search','status','archived']::text[],array[]::text[]);
select coalesce(jsonb_agg(card order by name,id),'[]') into r from (
select p.name,p.id,jsonb_build_object('id',p.id,'name',p.name,'businessName',p.business_name,'siteAddress',p.site_address,'status',p.status,
'archived',p.archived_at is not null,'coverFileId',(select file_id from public.project_covers c where c.project_id=p.id and c.is_active),
'reportCount',(select count(*) from public.diary_entries e where e.project_id=p.id and e.cancelled_at is null),
'openTaskCount',(select count(*) from public.tasks t where t.project_id=p.id and not t.completed and t.deleted_at is null)) card
from public.projects p where (not input ? 'status' or p.status=(input->>'status')::public.project_status)
and (p.archived_at is not null)=coalesce((input->>'archived')::boolean,false)
and (not input ? 'search' or strpos(lower(p.name||' '||p.business_name||' '||p.site_address),lower(btrim(input->>'search')))>0)) x;
return r;
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.diary_summary(input jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r jsonb;
begin
perform private.require_active(); perform private.keys(input,array['projectId','from','to']::text[],array[]::text[]);
with entries as (select e.* from public.diary_entries e where e.cancelled_at is null
and (not input ? 'projectId' or e.project_id=(input->>'projectId')::uuid)
and (not input ? 'from' or e.work_date>=(input->>'from')::date) and (not input ? 'to' or e.work_date<=(input->>'to')::date)),
per_project as (select e.project_id,p.name,count(*) reports,count(distinct work_date) days from entries e join public.projects p on p.id=e.project_id group by e.project_id,p.name)
select jsonb_build_object('reportCount',(select count(*) from entries),'workDays',(select count(distinct work_date) from entries),
'byProject',(select coalesce(jsonb_agg(jsonb_build_object('projectId',project_id,'projectName',name,'reportCount',reports,'workDays',days) order by name,project_id),'[]') from per_project)) into r;return r;
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.finance_month_totals(input jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r jsonb;
begin
perform private.require_active(); perform private.keys(input,array['projectId']::text[],array['projectId']::text[]);
perform private.require_project((input->>'projectId')::uuid,'finance',false);
select coalesce(jsonb_agg(item order by project_id,year,month),'[]') into r from (
select t.project_id,t.year,t.month,jsonb_build_object('year',t.year,'month',t.month,
'income',sum(case when t.kind='income' then t.amount when t.kind='income_refund' then -t.amount else 0 end),
'expense',sum(case when t.kind='expense' then t.amount when t.kind='expense_credit' then -t.amount else 0 end)) item
from public.transactions t join public.projects p on p.id=t.project_id where t.cancelled_at is null
and t.project_id=(input->>'projectId')::uuid
group by t.project_id,p.name,t.year,t.month) x; return r;
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.finance_all_month_totals(input jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r jsonb;
begin
perform private.require_owner(); perform private.keys(input,array['from','to']::text[],array[]::text[]);

select coalesce(jsonb_agg(item order by project_id,year,month),'[]') into r from (
select t.project_id,t.year,t.month,jsonb_build_object('projectId',t.project_id,'projectName',p.name,'year',t.year,'month',t.month,
'income',sum(case when t.kind='income' then t.amount when t.kind='income_refund' then -t.amount else 0 end),
'expense',sum(case when t.kind='expense' then t.amount when t.kind='expense_credit' then -t.amount else 0 end)) item
from public.transactions t join public.projects p on p.id=t.project_id where t.cancelled_at is null
and (not input ? 'from' or (t.year,t.month)>=((input->'from'->>'year')::int,(input->'from'->>'month')::int)) and (not input ? 'to' or (t.year,t.month)<=((input->'to'->>'year')::int,(input->'to'->>'month')::int))
group by t.project_id,p.name,t.year,t.month) x; return r;
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.system_bootstrap_owner(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u auth.users; r public.profiles;
begin
perform private.keys(input,array['userId','fullName']::text[],array['userId','fullName']::text[]);
perform pg_advisory_xact_lock(190012,1);
if exists(select 1 from public.profiles where is_owner) then perform private.fail('CONFLICT'); end if;
select * into u from auth.users where id=(input->>'userId')::uuid;
if not found then perform private.fail('NOT_FOUND'); end if;
insert into public.profiles(id,email,full_name,is_owner) values(u.id,lower(u.email),btrim(input->>'fullName'),true) returning * into r;
insert into public.sensitive_events(actor_id,actor_label,action,entity_type,entity_id) values(r.id,r.full_name,'owner.created','profile',r.id::text);
return private.saved(r.id,r.revision);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function public.system_owner_recovered(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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

create function public.system_finish_upload(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.stored_files; u public.profiles; allowed boolean;
begin
perform private.keys(input,array['fileId','actorId','sessionId','state','mime','sizeBytes','sha256','displayPath','displayState']::text[],array['fileId','actorId','sessionId','state']::text[]);
select * into r from public.stored_files where id=(input->>'fileId')::uuid for update;
if not found or r.state<>'pending' or r.uploaded_by<>(input->>'actorId')::uuid then perform private.fail('NOT_FOUND'); end if;
select * into u from public.profiles where id=r.uploaded_by for share;
if not u.is_active or not exists(select 1 from auth.sessions s where s.id=(input->>'sessionId')::uuid and s.user_id=u.id and s.created_at>=u.sessions_valid_after) then perform private.fail('UNAUTHENTICATED'); end if;
perform 1 from public.projects where id=r.project_id for share;
perform 1 from public.memberships where project_id=r.project_id and user_id=u.id for share;
allowed:=u.is_owner or (r.purpose<>'cover' and exists(select 1 from public.memberships m join public.projects p on p.id=m.project_id
where m.user_id=u.id and p.id=r.project_id and p.status='active' and p.archived_at is null and (r.purpose='diary' or m.role='manager')));
if not allowed then perform private.fail('FORBIDDEN'); end if;
if input->>'state' not in ('ready','rejected') then perform private.fail('VALIDATION'); end if;
if input->>'state'='ready' then
 if input->>'mime' not in ('application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif') or (r.purpose='cover' and input->>'mime'='application/pdf') then perform private.fail('LIMIT'); end if;
 if input->>'mime' is distinct from r.declared_mime or (input->>'sizeBytes')::bigint is distinct from r.declared_size then perform private.fail('VALIDATION'); end if;
 if input->>'displayState'='ready' and input->>'displayPath' is distinct from r.project_id::text||'/'||r.id::text||'.jpg' then perform private.fail('VALIDATION'); end if;
end if;
update public.stored_files set state=(input->>'state')::public.file_state,mime=input->>'mime',size_bytes=(input->>'sizeBytes')::bigint,
sha256=input->>'sha256',display_path=input->>'displayPath',display_state=coalesce((input->>'displayState')::public.display_state,'none'),
ready_at=case when input->>'state'='ready' then now() else null end where id=r.id returning * into r;
return jsonb_build_object('id',r.id,'name',r.original_name,'mime',r.mime,'sizeBytes',r.size_bytes,'displayState',r.display_state);
exception when unique_violation then perform private.fail('CONFLICT'); return null;
when foreign_key_violation then perform private.fail('VALIDATION'); return null;
when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
 perform private.fail('VALIDATION'); return null;
end $$;

create function private.reject_auth_email(event jsonb) returns jsonb language sql set search_path='' as $$
 select '{"error":{"http_code":403,"message":"שליחת מיילים אינה זמינה"}}'::jsonb
$$;

alter table public.profiles enable row level security;
create policy read_profiles on public.profiles for select to authenticated using ((select private.owner()) or (id=(select auth.uid()) and (select private.active())));
grant select on public.profiles to authenticated;

alter table public.memberships enable row level security;
create policy read_memberships on public.memberships for select to authenticated using ((select private.owner()) or (user_id=(select auth.uid()) and (select private.active())));
grant select on public.memberships to authenticated;

alter table public.projects enable row level security;
create policy read_projects on public.projects for select to authenticated using ((select private.member(id)));
grant select on public.projects to authenticated;

alter table public.project_contacts enable row level security;
create policy read_project_contacts on public.project_contacts for select to authenticated using ((select private.member(project_id)));
grant select on public.project_contacts to authenticated;

alter table public.project_private enable row level security;
create policy read_project_private on public.project_private for select to authenticated using ((select private.owner()));
grant select on public.project_private to authenticated;

alter table public.project_finance_settings enable row level security;
create policy read_project_finance_settings on public.project_finance_settings for select to authenticated using ((select private.finance(project_id)));
grant select on public.project_finance_settings to authenticated;

alter table public.project_covers enable row level security;
create policy read_project_covers on public.project_covers for select to authenticated using ((select private.owner()) or (is_active and (select private.member(project_id))));
grant select on public.project_covers to authenticated;

alter table public.stored_files enable row level security;
create policy read_stored_files on public.stored_files for select to authenticated using ((select private.read_file(id)));
grant select on public.stored_files to authenticated;

alter table public.documents enable row level security;
create policy read_documents on public.documents for select to authenticated using ((select private.read_document(id)));
grant select on public.documents to authenticated;

alter table public.document_grants enable row level security;
create policy read_document_grants on public.document_grants for select to authenticated using ((select private.owner()));
grant select on public.document_grants to authenticated;

alter table public.tasks enable row level security;
create policy read_tasks on public.tasks for select to authenticated using (deleted_at is null and (select private.member(project_id)));
grant select on public.tasks to authenticated;

alter table public.diary_entries enable row level security;
create policy read_diary_entries on public.diary_entries for select to authenticated using ((select private.read_entry(id)));
grant select on public.diary_entries to authenticated;

alter table public.diary_versions enable row level security;
create policy read_diary_versions on public.diary_versions for select to authenticated using ((select private.read_version(entry_id,version)));
grant select on public.diary_versions to authenticated;

alter table public.diary_attachments enable row level security;
create policy read_diary_attachments on public.diary_attachments for select to authenticated using (exists(select 1 from public.diary_version_files v where v.attachment_id=diary_attachments.id and (select private.read_version(v.entry_id,v.version))));
grant select on public.diary_attachments to authenticated;

alter table public.diary_version_files enable row level security;
create policy read_diary_version_files on public.diary_version_files for select to authenticated using ((select private.read_version(entry_id,version)));
grant select on public.diary_version_files to authenticated;

alter table public.transactions enable row level security;
create policy read_transactions on public.transactions for select to authenticated using ((select private.finance(project_id)) and (cancelled_at is null or (select private.owner())));
grant select on public.transactions to authenticated;

alter table public.sensitive_events enable row level security;
create policy read_sensitive_events on public.sensitive_events for select to authenticated using ((select private.owner()));
grant select on public.sensitive_events to authenticated;

revoke all on all functions in schema public from public, anon, authenticated, service_role;
revoke all on all functions in schema private from public, anon, authenticated, service_role;
grant usage on schema private to authenticated, supabase_auth_admin;
grant execute on function public.create_profile(jsonb) to authenticated;
grant execute on function public.update_profile(jsonb) to authenticated;
grant execute on function public.set_user_active(jsonb) to authenticated;
grant execute on function public.revoke_user_sessions(jsonb) to authenticated;
grant execute on function public.set_membership(jsonb) to authenticated;
grant execute on function public.remove_membership(jsonb) to authenticated;
grant execute on function public.set_finance_access(jsonb) to authenticated;
grant execute on function public.create_project(jsonb) to authenticated;
grant execute on function public.update_project(jsonb) to authenticated;
grant execute on function public.set_project_status(jsonb) to authenticated;
grant execute on function public.set_project_archived(jsonb) to authenticated;
grant execute on function public.create_task(jsonb) to authenticated;
grant execute on function public.update_task(jsonb) to authenticated;
grant execute on function public.set_task_completed(jsonb) to authenticated;
grant execute on function public.delete_task(jsonb) to authenticated;
grant execute on function public.begin_upload(jsonb) to authenticated;
grant execute on function public.set_project_cover(jsonb) to authenticated;
grant execute on function public.create_document(jsonb) to authenticated;
grant execute on function public.set_document_access(jsonb) to authenticated;
grant execute on function public.set_document_archived(jsonb) to authenticated;
grant execute on function public.create_entry(jsonb) to authenticated;
grant execute on function public.correct_entry(jsonb) to authenticated;
grant execute on function public.move_entry(jsonb) to authenticated;
grant execute on function public.cancel_entry(jsonb) to authenticated;
grant execute on function public.create_transaction(jsonb) to authenticated;
grant execute on function public.update_transaction(jsonb) to authenticated;
grant execute on function public.cancel_transaction(jsonb) to authenticated;
grant execute on function public.set_finance_link(jsonb) to authenticated;
grant execute on function public.get_actor(jsonb) to authenticated;
grant execute on function public.project_permissions(jsonb) to authenticated;
grant execute on function public.project_access_candidates(jsonb) to authenticated;
grant execute on function public.project_manager_names(jsonb) to authenticated;
grant execute on function public.get_pending_upload(jsonb) to authenticated;
grant execute on function public.authorize_file(jsonb) to authenticated;
grant execute on function public.project_cards(jsonb) to authenticated;
grant execute on function public.diary_summary(jsonb) to authenticated;
grant execute on function public.finance_month_totals(jsonb) to authenticated;
grant execute on function public.finance_all_month_totals(jsonb) to authenticated;
grant execute on function public.system_bootstrap_owner(jsonb) to service_role;
grant execute on function public.system_owner_recovered(jsonb) to service_role;
grant execute on function public.system_finish_upload(jsonb) to service_role;
grant execute on function private.active() to authenticated;
grant execute on function private.owner() to authenticated;
grant execute on function private.role_in(uuid) to authenticated;
grant execute on function private.member(uuid) to authenticated;
grant execute on function private.manager(uuid) to authenticated;
grant execute on function private.writable(uuid) to authenticated;
grant execute on function private.work(uuid) to authenticated;
grant execute on function private.manage(uuid) to authenticated;
grant execute on function private.finance(uuid) to authenticated;
grant execute on function private.finance_write(uuid) to authenticated;
grant execute on function private.read_document(uuid) to authenticated;
grant execute on function private.read_entry(uuid) to authenticated;
grant execute on function private.read_version(uuid,int) to authenticated;
grant execute on function private.correct_entry_allowed(uuid) to authenticated;
grant execute on function private.read_file(uuid) to authenticated;
grant execute on function private.require_active() to authenticated;
grant execute on function private.require_owner() to authenticated;
grant execute on function private.require_project(uuid,text,boolean) to authenticated;
grant execute on function private.keys(jsonb,text[],text[]) to authenticated;
grant execute on function private.fail(text,text) to authenticated;
grant execute on function private.reject_auth_email(jsonb) to supabase_auth_admin;
commit;
