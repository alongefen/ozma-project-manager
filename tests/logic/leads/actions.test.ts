import { beforeEach, afterEach, it, expect, vi } from 'vitest';
vi.mock('server-only',()=>({}));
const mocks = vi.hoisted(() => ({ context: vi.fn(), factory: vi.fn(), operation: vi.fn() }));
vi.mock('@/lib/auth/platform',()=>({createPlatform:async()=>({auth:{getContext:mocks.context}})}));
vi.mock('@/features/leads/logic/index',()=>({createLeadsApi:mocks.factory}));
import { LeadsApiInputSchemas } from '@/types/contracts/leads';
import * as actions from '@/features/leads/logic/actions';
const id='11111111-1111-4111-8111-111111111111';
const fields={name:'בדיקה',phone:'0500000000',inquiryDate:'2026-11-26'};
const inputs={listLeads:{archive:'all'}, getLead:{id}, createLead:{...fields,requestId:id,allowDuplicate:true}, updateLead:{id,expectedRevision:1,fields},setLeadStatus:{id,expectedRevision:1,status:'won'},setLeadArchived:{id,expectedRevision:1,archived:true},deleteLead:{id,expectedRevision:1}};
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('VERCEL_ENV','preview');vi.stubEnv('LEADS_PREVIEW_ENABLED','true');mocks.context.mockResolvedValue({ok:true,value:{actor:{isOwner:true}}});mocks.operation.mockResolvedValue({ok:true,value:[]});mocks.factory.mockReturnValue(Object.fromEntries(Object.keys(actions).map(k=>[k,mocks.operation])));});
afterEach(()=>vi.unstubAllEnvs());
for(const name of Object.keys(inputs) as (keyof typeof inputs)[]){
 const invoke=()=>actions[name](inputs[name] as never);
 it(`${name}: production flag true performs zero lead calls`,async()=>{vi.stubEnv('VERCEL_ENV','production');expect(await invoke()).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});expect(mocks.factory).not.toHaveBeenCalled();expect(mocks.operation).not.toHaveBeenCalled();});
 it(`${name}: non-owner performs zero lead calls`,async()=>{mocks.context.mockResolvedValue({ok:true,value:{actor:{isOwner:false}}});expect(await invoke()).toMatchObject({ok:false});expect(mocks.factory).not.toHaveBeenCalled();});
 it(`${name}: failed authentication performs zero lead calls`,async()=>{mocks.context.mockResolvedValue({ok:false,error:{code:'UNAUTHENTICATED'}});expect(await invoke()).toMatchObject({ok:false});expect(mocks.factory).not.toHaveBeenCalled();});
 it(`${name}: permitted Preview calls factory with server context`,async()=>{expect(await invoke()).toMatchObject({ok:true});expect(mocks.operation).toHaveBeenCalledWith({actor:{isOwner:true}},LeadsApiInputSchemas[name].parse(inputs[name]));});
}
it('maps unexpected context failure without reading leads',async()=>{mocks.context.mockRejectedValue(new Error('private'));expect(await actions.listLeads({})).toMatchObject({ok:false,error:{code:'UNAVAILABLE'}});expect(mocks.factory).not.toHaveBeenCalled();});
