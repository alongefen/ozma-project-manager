import {describe,expect,it,vi} from 'vitest';
import type {Platform,RequestContext} from '../../../src/types/contracts';
vi.mock('server-only',()=>({}));
import {createDiaryApi} from '../../../src/features/diary/logic/service';
const id='10000000-0000-4000-8000-000000000001';
const projectId='10000000-0000-4000-8000-000000000002';
const entry={id,project_id:projectId,work_date:'2026-11-22',entered_at:'2026-11-22T08:00:00Z',body:'דיווח',reporter_id:id,reporter_name:'בדוי',edited_at:null,edited_by_name:null,cancelled_at:null,revision:1};
function fixture(rows:unknown[]=[]) {
 const queries:{table:string;calls:[string,...unknown[]][]}[]=[];
 const from=vi.fn((table:string)=>{
  const calls:[string,...unknown[]][]=[];queries.push({table,calls});
  const data=table==='projects'?{name:'בדוי'}:table==='diary_entries'?rows:[];
  const q:Record<string,unknown>={then:(resolve:(v:unknown)=>unknown)=>Promise.resolve({data,error:null}).then(resolve)};
  for(const name of ['select','eq','gte','lte','order','limit','is','not','or','range'])q[name]=(...args:unknown[])=>{calls.push([name,...args]);return q;};
  q.maybeSingle=()=>Promise.resolve({data:table==='diary_entries'?rows[0]??null:data,error:null});return q;
 });
 const permissions={forProject:vi.fn().mockResolvedValue({ok:true,value:{view:true,report:true,manageAccess:false}}),requireOwner:vi.fn().mockResolvedValue({ok:false,error:{code:'FORBIDDEN',message:'אין הרשאה'}})};
 const ctx={actor:{userId:id,isOwner:false},today:'2026-11-22',db:{from}} as unknown as RequestContext;
 return {api:createDiaryApi({permissions} as unknown as Platform),ctx,queries,from,permissions};
}
describe('Diary RLS query composition',()=>{
 it('uses one source, inclusive bounds, cancellation filtering and deterministic order',async()=>{
 const f=fixture([entry]);const result=await f.api.listEntries(f.ctx,{projectId,from:'2026-11-01',to:'2026-11-22'});
 expect(result).toMatchObject({ok:true,value:{items:[{id,projectName:'בדוי',reporterId:id,canCorrect:true,canMoveOrCancel:false}],nextCursor:null}});
 const calls=f.queries[0].calls;expect(calls).toContainEqual(['gte','work_date','2026-11-01']);expect(calls).toContainEqual(['lte','work_date','2026-11-22']);expect(calls).toContainEqual(['eq','project_id',projectId]);expect(calls).toContainEqual(['is','cancelled_at',null]);expect(calls.filter(c=>c[0]==='order').map(c=>c[1])).toEqual(['work_date','entered_at','id']);
 });
 it('rejects missing records without reading history',async()=>{const f=fixture();expect(await f.api.listVersions(f.ctx,{id})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});expect(f.queries.map(q=>q.table)).toEqual(['diary_entries']);});
 it('validates malformed and filter-mismatched cursors before queries',async()=>{
 const f=fixture(Array.from({length:51},()=>entry));const result=await f.api.listEntries(f.ctx,{});if(!result.ok)throw new Error('fixture failed');const before=f.from.mock.calls.length;
 expect(await f.api.listEntries(f.ctx,{projectId,cursor:result.value.nextCursor!})).toMatchObject({ok:false,error:{code:'VALIDATION'}});expect(await f.api.listEntries(f.ctx,{cursor:'%%%'})).toMatchObject({ok:false,error:{code:'VALIDATION'}});expect(f.from.mock.calls.length).toBe(before);
 });
 it('does not expose cancelled collection to a non-owner',async()=>{const f=fixture();expect(await f.api.listEntries(f.ctx,{cancelled:true})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});expect(f.from).not.toHaveBeenCalled();});
 it('never offers correction in a completed project',async()=>{const f=fixture([entry]);f.permissions.forProject.mockResolvedValue({ok:true,value:{view:true,report:false,manageAccess:false}});expect(await f.api.getEntry(f.ctx,{id})).toMatchObject({ok:true,value:{canCorrect:false,canMoveOrCancel:false}});});
 it('omits cancelled entry from entry report',async()=>{const f=fixture([{...entry,cancelled_at:'2026-11-22T09:00:00Z'}]);expect(await f.api.listForReport(f.ctx,{scope:{kind:'entry',entryId:id}})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});});
});
