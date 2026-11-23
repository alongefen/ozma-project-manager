import {expect,it,vi} from 'vitest';
import type {Platform,RequestContext} from '../../../src/types/contracts';
vi.mock('server-only',()=>({}));
import {createTasksApi} from '../../../src/features/tasks/logic';
import {fetchAll} from '../../../src/lib/db/rpc';
const id='27f5161e-b0d8-47e2-8383-2bf19087b718';
function setup(options:{denied?:boolean;error?:boolean}={}){
 const rows=Array.from({length:1001},(_,n)=>({id,project_id:id,body:`פתק ${n}`,completed:n===1000,due_date:null,created_at:'2026-11-22T00:00:00Z',revision:1}));
 const chains:Record<string,ReturnType<typeof vi.fn>>[]=[];
 const from=vi.fn((_table:string)=>{void _table;let complete=false,head=false;const q:Record<string,ReturnType<typeof vi.fn>>={};for(const key of ['select','eq','is','order']) q[key]=vi.fn((a:unknown,b:unknown)=>{if(key==='select')head=!!(b as {head?:boolean})?.head;if(key==='eq'&&a==='completed')complete=b as boolean;return q;});q.range=vi.fn(async(start:number,end:number)=>({data:rows.slice(start,end+1),error:options.error?{message:'internal secret'}:null}));q.then=vi.fn((resolve:(result:unknown)=>unknown)=>resolve({count:complete?1:1000,error:options.error?{message:'internal secret'}:null,data:head?null:rows}));chains.push(q);return q;});
 const permission=vi.fn().mockResolvedValue(options.denied?{ok:false,error:{code:'NOT_FOUND',message:'בדיקה'}}:{ok:true,value:{view:true,writeTasks:false}});
 return {api:createTasksApi({fetchAll,permissions:{forProject:permission}} as unknown as Platform),ctx:{db:{from}} as unknown as RequestContext,from,permission,chains};
}
it('reads all pages and database counts with live project permission',async()=>{const {api,ctx,from,chains,permission}=setup();const r=await api.listTasks(ctx,{projectId:id});expect(r).toMatchObject({ok:true,value:{openCount:1000,completedCount:1,canWrite:false}});if(!r.ok)return;expect(r.value.open).toHaveLength(1000);expect(r.value.completed).toHaveLength(1);expect(r.value.open[0]).toMatchObject({projectId:id,dueDate:null});expect(permission).toHaveBeenCalledWith(ctx,{projectId:id});expect(from.mock.calls.every(c=>c[0]==='tasks')).toBe(true);for(const q of chains){expect(q.eq).toHaveBeenCalledWith('project_id',id);expect(q.is).toHaveBeenCalledWith('deleted_at',null);}expect(chains.flatMap(q=>q.range.mock.calls).some(c=>c[0]===1000)).toBe(true);});
it('does not query data after denied project access',async()=>{const {api,ctx,from}=setup({denied:true});expect(await api.listTasks(ctx,{projectId:id})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});expect(from).not.toHaveBeenCalled();});
it('returns generic failure for database errors without partial success',async()=>{const {api,ctx}=setup({error:true});const r=await api.listTasks(ctx,{projectId:id});expect(r).toMatchObject({ok:false,error:{code:'UNAVAILABLE'}});expect(JSON.stringify(r)).not.toContain('secret');});
it('validates project id before permission or data calls',async()=>{const {api,ctx,permission,from}=setup();expect(await api.listTasks(ctx,{projectId:'bad'})).toMatchObject({ok:false,error:{code:'VALIDATION'}});expect(permission).not.toHaveBeenCalled();expect(from).not.toHaveBeenCalled();});
