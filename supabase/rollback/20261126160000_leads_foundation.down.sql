-- PROPOSAL ONLY: requires a separate approved operational window. Never auto-applied.
-- Containment rollback preserves all lead data, unique retry keys and supporting objects.
-- Disable routes/actions/Preview flag first; this also removes direct Data API access.
-- No DROP TABLE, DELETE or changes to existing business data/auth users.
begin;
revoke all on table public.leads from public,anon,authenticated,service_role;
revoke all on function public.create_lead(jsonb),public.update_lead(jsonb),
 public.set_lead_status(jsonb),public.set_lead_archived(jsonb),public.delete_lead(jsonb)
 from public,anon,authenticated,service_role;
commit;
-- Re-enablement (not part of this rollback): after new approval/review, restore only
-- SELECT on leads and EXECUTE on the five RPCs to authenticated. Do not rerun migration.
-- Physical removal is intentionally omitted: it would destroy retained lead data and
-- needs a separately reviewed preservation/removal decision and D31 approval.
