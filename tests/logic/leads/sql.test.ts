import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { LeadFieldsSchema, leadStatuses, leadSources, leadMarketingCompanies } from '../../../src/types/contracts/leads';
const sql=readFileSync('supabase/migrations/20261126160000_leads_foundation.sql','utf8');
const rollback=readFileSync('supabase/rollback/20261126160000_leads_foundation.down.sql','utf8');
describe('proposal structure only (not executed SQL/hosted permission proof)',()=>{
 it('uses exactly contract enum codes',()=>{for(const values of [leadStatuses,leadSources,leadMarketingCompanies])expect(sql).toContain(`array[${values.map(v=>`'${v}'`).join(',')}]::text[]`);});
 it('denies direct writes/service role and has owner-only live-row SELECT',()=>{expect(sql).toContain('alter table public.leads enable row level security');expect(sql).toContain('revoke all on table public.leads from public,anon,authenticated,service_role');expect(sql).toContain('grant select on table public.leads to authenticated');expect(sql).toContain('using ((select private.owner()) and deleted_at is null)');expect(sql).not.toMatch(/grant (insert|update|delete|all)/i);});
 it('has owner guard before input checks, fixed paths and narrow public grants',()=>{
  expect(sql.match(/perform private.require_owner\(\);/g)).toHaveLength(2);
  const create=sql.slice(sql.indexOf('create function public.create_lead'));
  expect(create.indexOf('perform private.require_owner();')).toBeLessThan(create.indexOf('perform private.lead_keys'));
  for(const name of ['create_lead','update_lead','set_lead_status','set_lead_archived','delete_lead']) {expect(sql).toContain(`revoke all on function public.${name}(jsonb) from public,anon,authenticated,service_role`);expect(sql).toContain(`grant execute on function public.${name}(jsonb) to authenticated`);}
  expect(sql.match(/security definer set search_path=''/g)).toHaveLength(5);
 });
 it('locks writes, checks retries before duplicates, includes archive and excludes deleted',()=>{
  expect(sql).toContain('unique(created_by,request_id)');expect(sql.match(/pg_advisory_xact_lock\(190049,1\)/g)).toHaveLength(2);
  const retry=sql.indexOf('where created_by=auth.uid() and request_id=request');
  const duplicate=sql.indexOf('select count(*) into duplicates');expect(retry).toBeLessThan(duplicate);
  expect(sql).toContain('where canonical_phone=phone_key and deleted_at is null');expect(sql).toContain('if duplicates>0 and not override');
  expect(sql).toContain("if r.deleted_at is not null then perform private.fail('NOT_FOUND')");
 });
 it('checks revision and live row for every mutation, has no physical deletion',()=>{expect(sql).toContain('and deleted_at is null for update');expect(sql).toContain("private.revision(r.revision,input->'expectedRevision')");expect(sql).toContain('set deleted_at=now()');expect(sql).not.toMatch(/delete from|project_id|create or replace/i);});
 it('rolls back access without destroying records or touching shared objects',()=>{expect(rollback).toContain('revoke all on table public.leads');expect(rollback).not.toMatch(/^\s*(drop|delete|truncate|alter) /im);expect(sql).toContain('begin;');expect(sql.trim().endsWith('commit;')).toBe(true);});
});

// Static proposal parity: executes the extracted pattern in JS, not PostgreSQL.
// Hosted SQL compilation/runtime verification remains a separate D31 gate.
describe('persisted email validation matches pinned Zod', () => {
 it('uses the installed email pattern with deterministic ASCII collation and no email trimming', () => {
  const match = sql.match(/\(f->>'email'\) collate "C" !~ '((?:''|[^'])*)'/);
  expect(match).not.toBeNull();
  expect(match![1].replaceAll("''", "'")).toBe(z.regexes.email.source);
  expect(sql).toContain("if k='email' then continue; end if;");
 });
 it('preserves optional null and the 254-character contract', () => {
  expect(sql).toContain("if f->'email'<>'null'::jsonb and length(f->>'email') not between 1 and 254");
  expect(sql).toContain("if f->'email'<>'null'::jsonb and (f->>'email') collate");
  expect(LeadFieldsSchema.shape.email.safeParse(null).success).toBe(true);
  expect(LeadFieldsSchema.shape.email.parse(undefined)).toBeNull();
 });
 it.each([
  ['a@b.c', false], ['a..b@example.com', false],
  ['a@example.com', true], ['a+tag@sub.example.com', true],
  ['A.Tag+Lead@Sub.Example.COM', true], ["o'neil@example.com", true],
  ['.a@example.com', false], ['a.@example.com', false],
  ['a@-example.com', false], ['a@example.12', false],
  [' a@example.com ', false], ['a@example.com\n', false], ['', false],
  [`${'a'.repeat(242)}@example.com`, true],
  [`${'a'.repeat(243)}@example.com`, false],
 ])('matches the contract for %j', (email, expected) => {
  const pattern = sql.match(/\(f->>'email'\)(?: collate "C")? !~ '((?:''|[^'])*)'/);
  expect(pattern).not.toBeNull();
  const regex = new RegExp(pattern![1].replaceAll("''", "'"));
  const length = sql.match(/length\(f->>'email'\) not between (\d+) and (\d+)/)!;
  const accepts = email.length >= Number(length[1]) && email.length <= Number(length[2]) && regex.test(email);
  expect(LeadFieldsSchema.shape.email.safeParse(email).success).toBe(expected);
  expect(accepts).toBe(expected);
 });
});
