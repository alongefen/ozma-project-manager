import { describe, expect, it, vi } from 'vitest';
import type { Platform, RequestContext } from '../../../src/types/contracts';
vi.mock('server-only',()=>({}));
import { createFilesApi } from '../../../src/features/files/logic';
import { fetchAll } from '../../../src/lib/db/rpc';
const id='6d54739e-32cf-44fb-9c7f-f26aef663d88';
const row={id,project_id:id,category:'plans',uploaded_by_name:'בדוי',created_at:'2026-11-22T12:00:00Z',archived_at:null,revision:1,access:'selected',stored_files:{id,original_name:'test.png',mime:'image/png',size_bytes:20,display_state:'none'},document_grants:[]};
function fixture(owner=false, grantCount=0, documentCount=1){
 const calls:{table:string;method:string;args:unknown[]}[]=[];
 let error:unknown=null;
 const from=vi.fn((table:string)=>{
  let head=false, single=false, from=0, to=999;
  const q:Record<string,unknown>={};
  for(const method of ['select','eq','is','not','ilike','order','range','in','maybeSingle']) q[method]=(...args:unknown[])=>{calls.push({table,method,args});if(method==='select')head=!!(args[1] as {head?:boolean})?.head;if(method==='maybeSingle')single=true;if(method==='range'){from=Number(args[0]);to=Number(args[1]);}return q;};
  q.then=(resolve:(r:unknown)=>unknown)=>resolve({data:head?null:table==='document_grants'?Array.from({length:grantCount},(_,i)=>({user_id:String(i)})).slice(from,to+1):single?row:Array.from({length:documentCount},()=>row).slice(from,to+1),count:head?1350:null,error});
  return q;
 });
 const ctx={actor:{isOwner:owner},db:{from},today:'2026-11-22'} as unknown as RequestContext;
 const platform={fetchAll,permissions:{forProject:vi.fn().mockResolvedValue({ok:true,value:{view:true}}),requireOwner:vi.fn().mockResolvedValue(owner?{ok:true,value:null}:{ok:false,error:{code:'FORBIDDEN',message:'נדחה'}})}} as unknown as Platform;
 return {ctx,platform,calls,api:createFilesApi(platform),setError:(x:unknown)=>{error=x;}};
}
describe('מסמכים: קריאות RLS, מונים ופרטי פלט',()=>{
 it('uses exact counts independent of returned items, preserves four category counts',async()=>{
  const f=fixture();const result=await f.api.listDocuments(f.ctx,{projectId:id,category:'plans'});
  expect(result).toMatchObject({ok:true,value:{items:[{id}],countByCategory:{specification:1350,plans:1350,additional_plans:1350,renderings:1350}}});
  expect(f.calls.filter(x=>x.method==='select'&&(x.args[1] as {count?:string})?.count==='exact')).toHaveLength(4);
  const categoryFilters=f.calls.filter(x=>x.method==='eq'&&x.args[0]==='category');expect(categoryFilters).toHaveLength(5);
 });
 it('escapes literal LIKE characters and searches embedded filename, excludes archive by default',async()=>{
  const f=fixture(); await f.api.listDocuments(f.ctx,{projectId:id,search:'a%_B'});
  expect(f.calls.filter(x=>x.method==='ilike').every(x=>x.args[0]==='stored_files.original_name'&&x.args[1]==='%a\\%\\_B%')).toBe(true);
  expect(f.calls.some(x=>x.method==='is'&&x.args[0]==='archived_at')).toBe(true);
 });
 it('does not return access data, grants or storage paths to non-owner',async()=>{
  const f=fixture();const result=await f.api.getDocument(f.ctx,{id}); expect(result.ok).toBe(true);
  if(result.ok){expect(result.value).not.toHaveProperty('access');expect(result.value.file).toEqual({id,name:'test.png',mime:'image/png',sizeBytes:20,displayState:'none'});}
 });
 it('getDocument by id is closed to a non-owner when the project is not viewable (finished project)',async()=>{
  const f=fixture();(f.platform.permissions.forProject as ReturnType<typeof vi.fn>).mockResolvedValue({ok:true,value:{view:false}});
  expect(await f.api.getDocument(f.ctx,{id})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});
 });
 it('paginates lists beyond the Data API page limit',async()=>{const f=fixture(false,0,1001);const result=await f.api.listDocuments(f.ctx,{projectId:id});expect(result.ok&&result.value.items.length).toBe(1001);expect(f.calls.some(x=>x.method==='range'&&x.args[0]===1000)).toBe(true);});
 it('fails closed on failed metadata or count reads',async()=>{
  const f=fixture();f.setError({message:'provider internal secret'});expect(await f.api.listDocuments(f.ctx,{projectId:id})).toMatchObject({ok:false,error:{code:'UNAVAILABLE'}});
 });
 it('reads owner selected grants through paginated standalone queries',async()=>{
  const f=fixture(true,1001);const result=await f.api.getDocument(f.ctx,{id});expect(result).toMatchObject({ok:true});if(result.ok)expect(result.value.access).toMatchObject({mode:'selected',userIds:Array.from({length:1001},(_,i)=>String(i))});
  expect(f.calls.some(x=>x.table==='document_grants'&&x.method==='range')).toBe(true);
 });
});
