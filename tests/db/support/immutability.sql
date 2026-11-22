-- Test the triggers themselves with the management connection, in addition to API grants.
-- Every attempted mutation must raise FORBIDDEN; the enclosing transaction rolls back.
begin;
do $$
declare statement text;
begin
 if not exists(select 1 from public.diary_versions) or not exists(select 1 from public.stored_files where state='ready')
 or not exists(select 1 from public.transactions where cancelled_at is not null)
 then raise exception 'Run the API fixtures before this audit'; end if;
 foreach statement in array array[
  'update public.diary_versions set body=body',
  'delete from public.diary_versions',
  'update public.diary_version_files set position=position',
  'delete from public.diary_version_files',
  'update public.diary_attachments set created_at=created_at',
  'delete from public.diary_attachments',
  'update public.sensitive_events set action=action',
  'delete from public.sensitive_events',
  'update public.stored_files set ready_at=ready_at where state=''ready''',
  'delete from public.stored_files',
  'delete from public.diary_entries',
  'update public.diary_entries set entered_at=entered_at+interval ''1 second'' where cancelled_at is null',
  'update public.diary_entries set body=body where cancelled_at is not null',
  'delete from public.transactions',
  'update public.transactions set details=details where cancelled_at is not null'
 ] loop
  begin
   execute statement;
   raise exception 'IMMUTABILITY_TEST_FAILED: %',statement;
  exception when sqlstate 'P0001' then
   if sqlerrm<>'FORBIDDEN' then raise; end if;
  end;
 end loop;
end $$;
select '15 trigger mutation attempts rejected' as result;
rollback;
