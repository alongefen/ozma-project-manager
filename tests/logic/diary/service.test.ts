import { describe, expect, it, vi } from 'vitest';
import type { Platform, RequestContext } from '../../../src/types/contracts';
vi.mock('server-only', () => ({}));
import { createDiaryApi } from '../../../src/features/diary/logic/service';
const id='10000000-0000-4000-8000-000000000001';
const projectId='10000000-0000-4000-8000-000000000002';
const requestId='10000000-0000-4000-8000-000000000003';
const ctx={actor:{userId:id,fullName:'בודק',email:'test@example.invalid',isOwner:false},today:'2026-11-22',db:{from:vi.fn()}} as unknown as RequestContext;
function fixture() {
 const rpc=vi.fn().mockResolvedValue({ok:true,value:{id,revision:1}});
 const platform={rpc,permissions:{forProject:vi.fn().mockResolvedValue({ok:true,value:{view:true,report:true,manageAccess:false}})}} as unknown as Platform;
 return {api:createDiaryApi(platform),rpc};
}
describe('Diary server orchestration',()=>{
 it('creates through the authenticated context and preserves retry key and file order',async()=>{
 const {api,rpc}=fixture();const input={requestId,projectId,workDate:'2026-11-21',body:' דיווח ',fileIds:[id]};
 expect(await api.createEntry(ctx,input)).toEqual({ok:true,value:{id,revision:1}});
 expect(rpc).toHaveBeenCalledWith(ctx,'create_entry',{...input,body:'דיווח'});
 });
 it.each(['reporterId','enteredAt','editedAt'])('rejects forged %s before writing',async key=>{
 const {api,rpc}=fixture();expect(await api.createEntry(ctx,{requestId,projectId,workDate:'2026-11-21',body:'טקסט',fileIds:[],[key]:id} as never)).toMatchObject({ok:false,error:{code:'VALIDATION'}});expect(rpc).not.toHaveBeenCalled();
 });
 it.each(['','   '])('rejects empty body %j',async body=>{const {api,rpc}=fixture();expect(await api.createEntry(ctx,{requestId,projectId,workDate:'2026-11-21',body,fileIds:[]})).toMatchObject({ok:false,error:{code:'VALIDATION'}});expect(rpc).not.toHaveBeenCalled();});
 it('rejects duplicate file IDs',async()=>{const {api,rpc}=fixture();expect(await api.createEntry(ctx,{requestId,projectId,workDate:'2026-11-21',body:'דיווח',fileIds:[id,id]})).toMatchObject({ok:false,error:{code:'VALIDATION'}});expect(rpc).not.toHaveBeenCalled();});
 it('corrects via revision and complete replacement file order',async()=>{const {api,rpc}=fixture();const input={id,expectedRevision:2,body:'תיקון',fileIds:[projectId,id]};await api.correctEntry(ctx,input);expect(rpc).toHaveBeenCalledWith(ctx,'correct_entry',input);});
 it('forbids moving date through correctEntry',async()=>{const {api,rpc}=fixture();expect(await api.correctEntry(ctx,{id,expectedRevision:1,body:'תיקון',fileIds:[],workDate:'2026-11-01'} as never)).toMatchObject({ok:false,error:{code:'VALIDATION'}});expect(rpc).not.toHaveBeenCalled();});
 it.each(['FORBIDDEN','PROJECT_READ_ONLY','CONFLICT','VALIDATION'])('preserves database denial %s',async code=>{const {api,rpc}=fixture();rpc.mockResolvedValue({ok:false,error:{code,message:'נדחה'}});expect(await api.correctEntry(ctx,{id,expectedRevision:1,body:'תיקון',fileIds:[]})).toMatchObject({ok:false,error:{code}});});
 it('uses separate move and cancel RPC with revision',async()=>{const {api,rpc}=fixture();await api.moveEntry(ctx,{id,expectedRevision:1,projectId,workDate:'2026-11-20'});await api.cancelEntry(ctx,{id,expectedRevision:2});expect(rpc.mock.calls.map(c=>c[1])).toEqual(['move_entry','cancel_entry']);});
 it('rejects reversed summary range before database access',async()=>{const {api,rpc}=fixture();expect(await api.getSummary(ctx,{from:'2026-11-22',to:'2026-11-01'})).toMatchObject({ok:false,error:{code:'VALIDATION'}});expect(rpc).not.toHaveBeenCalled();});
 it('passes both inclusive bounds and project filter to RLS summary RPC',async()=>{const {api,rpc}=fixture();rpc.mockResolvedValue({ok:true,value:{reportCount:0,workDays:0,byProject:[]}});const input={projectId,from:'2026-11-01',to:'2026-11-22'};await api.getSummary(ctx,input);expect(rpc).toHaveBeenCalledWith(ctx,'diary_summary',input);});
});
