import { describe, it, expect, vi } from 'vitest';
import type { RequestContext } from '../../../src/types/contracts';
import { LeadFiltersSchema, type LeadRow } from '../../../src/types/contracts/leads';
vi.mock('server-only',()=>({}));
import { createLeadsApi } from '../../../src/features/leads/logic';
import { fetchAll } from '../../../src/lib/db/rpc';
import { filterLeads, leadIsDue } from '../../../src/features/leads/logic/filters';
const id='27f5161e-b0d8-47e2-8383-2bf19087b718';
const row={id,revision:1,name:'ליד בדיקה',phone:'050-000-0000',canonical_phone:'0500000000',email:null,company_name:'חברה בדויה',business_type:null,project_budget:null,has_designer:'unknown',has_plan_set:'unknown',source:'manual',marketing_company:null as string|null,inquiry_date:'2026-11-26',status:'new',follow_up_date:'2026-11-26',notes:null,archived_at:null as string|null,deleted_at:null,created_at:'2026-11-26T10:00:00Z',updated_at:'2026-11-26T10:00:00Z',created_by:id,request_id:id};
function setup(rows=[row]) {
 const query={select:vi.fn(),is:vi.fn(),order:vi.fn(),eq:vi.fn(),range:vi.fn(),maybeSingle:vi.fn()};
 for(const key of ['select','is','order','eq'] as const)query[key].mockReturnValue(query);
 query.range.mockImplementation(async(from:number,to:number)=>({data:rows.slice(from,to+1),error:null}));
 query.maybeSingle.mockResolvedValue({data:rows[0]??null,error:null});
 const from=vi.fn().mockReturnValue(query);
 const ctx={db:{from},today:'2026-11-26'} as unknown as RequestContext;
 const requireOwner=vi.fn().mockResolvedValue({ok:true,value:null});
 const api=createLeadsApi({permissions:{requireOwner},fetchAll,rpc:vi.fn()} as never);
 return {api,ctx,from,query,requireOwner};
}
describe('lead reads',()=>{
 it('loads all RLS pages with stable order and filters deleted at DB',async()=>{
  const {api,ctx,query}=setup(Array.from({length:1001},()=>({...row})));
  const result=await api.listLeads(ctx,{});expect(result.ok&&result.value.length).toBe(1001);
  expect(query.range.mock.calls).toEqual([[0,999],[1000,1999]]);
  expect(query.is).toHaveBeenCalledWith('deleted_at',null);
  expect(query.order.mock.calls).toEqual([['inquiry_date',{ascending:false}],['id',{ascending:false}],['inquiry_date',{ascending:false}],['id',{ascending:false}]]);
 });
 it('checks active owner before any reads and exposes no counters',async()=>{const {api,ctx,from,requireOwner}=setup();requireOwner.mockResolvedValue({ok:false,error:{code:'FORBIDDEN'}});expect(await api.listLeads(ctx,{})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});expect(await api.getLead(ctx,{id})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});expect(from).not.toHaveBeenCalled();});
 it('gets archived records but explicitly excludes deleted rows',async()=>{const {api,ctx,query}=setup([{...row,archived_at:'2026-11-26T11:00:00Z'}]);expect(await api.getLead(ctx,{id})).toMatchObject({ok:true,value:{archivedAt:'2026-11-26T11:00:00Z'}});expect(query.is).toHaveBeenCalledWith('deleted_at',null);});
 it('maps invisible/deleted records to not found',async()=>{const {api,ctx}=setup([]);expect(await api.getLead(ctx,{id})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});});
 it('fails closed on a failed later page, not partial success',async()=>{const {api,ctx,query}=setup(Array.from({length:1000},()=>row));query.range.mockResolvedValueOnce({data:Array.from({length:1000},()=>row),error:null}).mockResolvedValueOnce({data:null,error:{message:'private provider details'}});expect(await api.listLeads(ctx,{})).toMatchObject({ok:false,error:{code:'UNAVAILABLE'}});});
 it('rejects malformed row data',async()=>{const {api,ctx}=setup([{...row,status:'invented'}]);expect(await api.listLeads(ctx,{})).toMatchObject({ok:false,error:{code:'UNAVAILABLE'}});});
 it('applies archive/status/due/search/company to the same population',async()=>{
  const {api,ctx}=setup([row,{...row,status:'won'},{...row,archived_at:'2026-11-26T11:00:00Z'},{...row,marketing_company:'new_company'}]);
  const result=await api.listLeads(ctx,{search:'+972 50 0000000',statuses:['new'],dueOnly:true,marketingCompany:'new_company'});
  expect(result.ok&&result.value.length).toBe(1);
  expect(await api.listLeads(ctx,{archive:'archived'})).toMatchObject({ok:true,value:[{archivedAt:'2026-11-26T11:00:00Z'}]});
 });
 it('searches company and name without interpolating PostgREST filters',async()=>{const {api,ctx}=setup();const result=await api.listLeads(ctx,{search:'בדויה'});expect(result.ok&&result.value.length).toBe(1);});
 it.each(['won','irrelevant','denies_inquiry'] as const)('excludes terminal status %s from due',status=>expect(leadIsDue({status,followUpDate:'2026-11-25'},'2026-11-26')).toBe(false));
 it('keeps no-answer eligible and excludes future/missing dates',()=>{expect(leadIsDue({status:'no_answer',followUpDate:'2026-11-26'},'2026-11-26')).toBe(true);expect(leadIsDue({status:'new',followUpDate:null},'2026-11-26')).toBe(false);expect(leadIsDue({status:'new',followUpDate:'2026-11-27'},'2026-11-26')).toBe(false);});
 it('does not turn punctuation-only search into match-all',()=>expect(filterLeads([{name:'בדיקה',companyName:null,phone:'123',canonicalPhone:'123',archivedAt:null} as LeadRow],LeadFiltersSchema.parse({search:'--'}),'2026-11-26')).toEqual([]));
});
