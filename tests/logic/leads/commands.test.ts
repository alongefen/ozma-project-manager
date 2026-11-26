import { describe, it, expect, vi } from 'vitest';
import type { RequestContext } from '../../../src/types/contracts';
vi.mock('server-only',()=>({}));
import { createLeadsApi } from '../../../src/features/leads/logic';
const id='27f5161e-b0d8-47e2-8383-2bf19087b718';
const ctx={ today:'2026-11-26' } as RequestContext;
const input={requestId:id,name:'ליד בדיקה',phone:'050-000-0000',inquiryDate:ctx.today};
function setup() {
 const rpc=vi.fn().mockResolvedValue({ok:true,value:{kind:'saved',saved:{id,revision:1}}});
 const requireOwner=vi.fn().mockResolvedValue({ok:true,value:null});
 const api=createLeadsApi({rpc,fetchAll:vi.fn(),permissions:{requireOwner} } as never);
 return {rpc,requireOwner,api};
}
describe('lead commands',()=>{
 it('requires owner before validating input or calling RPC',async()=>{const {api,requireOwner,rpc}=setup(); requireOwner.mockResolvedValue({ok:false,error:{code:'FORBIDDEN'}}); expect(await api.createLead(ctx,{} as never)).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});expect(rpc).not.toHaveBeenCalled();});
 it('preserves duplicate warning without inserting in application',async()=>{const {api,rpc}=setup();rpc.mockResolvedValue({ok:true,value:{kind:'duplicate',duplicateCount:2}});expect(await api.createLead(ctx,input)).toEqual({ok:true,value:{kind:'duplicate',duplicateCount:2}});expect(rpc).toHaveBeenCalledOnce();});
 it('passes explicit override and same request ID on retry',async()=>{const {api,rpc}=setup();await api.createLead(ctx,{...input,allowDuplicate:true});await api.createLead(ctx,{...input,allowDuplicate:true});expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);expect(rpc.mock.calls[0][2]).toMatchObject({requestId:id,allowDuplicate:true});});
 it.each(['CONFLICT','NOT_FOUND','UNAUTHENTICATED'])('preserves %s from SQL',async code=>{const {api,rpc}=setup();rpc.mockResolvedValue({ok:false,error:{code,message:'בדיקה'}});expect(await api.setLeadStatus(ctx,{id,expectedRevision:1,status:'called'})).toMatchObject({ok:false,error:{code}});});
 it.each([
 ['setLeadStatus','set_lead_status',{id,expectedRevision:2,status:'won'}],
 ['setLeadArchived','set_lead_archived',{id,expectedRevision:2,archived:true}],
 ['deleteLead','delete_lead',{id,expectedRevision:2}],
 ] as const)('uses matching write RPC %s',async(method,name,value)=>{
  const {api,rpc}=setup();rpc.mockResolvedValue({ok:true,value:{id,revision:3}});
  const operation=api[method] as (context:RequestContext, input:typeof value)=>Promise<{ok:boolean}>;
  expect((await operation(ctx,value)).ok).toBe(true);expect(rpc.mock.calls[0][1]).toBe(name);
 });
 it('sends full replacement fields for update',async()=>{const {api,rpc}=setup();rpc.mockResolvedValue({ok:true,value:{id,revision:3}});expect((await api.updateLead(ctx,{id,expectedRevision:2,fields:{name:input.name,phone:input.phone,inquiryDate:input.inquiryDate}})).ok).toBe(true);expect(rpc.mock.calls[0][1]).toBe('update_lead');});
 it('redacts thrown provider details',async()=>{const {api,rpc}=setup();rpc.mockRejectedValue(new Error('private data'));expect(await api.createLead(ctx,input)).toMatchObject({ok:false,error:{code:'UNAVAILABLE'}});});
});
