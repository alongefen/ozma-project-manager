import {describe, it, expect, vi} from 'vitest';
import type {Platform, RequestContext} from '../../../src/types/contracts';
vi.mock('server-only',()=>({}));
import {createTasksApi} from '../../../src/features/tasks/logic';
const id='27f5161e-b0d8-47e2-8383-2bf19087b718';
const ctx={} as RequestContext;
const create={requestId:id,projectId:id,body:'פתק',dueDate:null,completed:false};
function setup(){const rpc=vi.fn().mockResolvedValue({ok:true,value:{id,revision:1}});return {rpc,api:createTasksApi({rpc} as unknown as Platform)};}
describe('פקודות משימות',()=>{
 it.each([
  ['createTask','create_task',create],
  ['updateTask','update_task',{id,expectedRevision:2,body:'תיקון',dueDate:'2026-12-01'}],
  ['setTaskCompleted','set_task_completed',{id,expectedRevision:3,completed:true}],
  ['deleteTask','delete_task',{id,expectedRevision:4}],
 ] as const)('%s uses only matching RPC with unchanged revision/request',async(method,rpcName,input)=>{
  const {api,rpc}=setup();const result=await (api[method] as (ctx: RequestContext, input: unknown) => Promise<{ok:boolean}>)(ctx,input);
  expect(result.ok).toBe(true);expect(rpc).toHaveBeenCalledExactlyOnceWith(ctx,rpcName,input);
 });
 it.each([{...create,body:'   '},{...create,body:'א'.repeat(2001)},{...create,dueDate:'2026-02-30'},{...create,projectId:'bad'},{...create,actor:{isOwner:true}}])('rejects invalid create before RPC',async input=>{const {api,rpc}=setup();expect(await api.createTask(ctx,input)).toMatchObject({ok:false,error:{code:'VALIDATION'}});expect(rpc).not.toHaveBeenCalled();});
 it('trims body and preserves nullable date',async()=>{const {api,rpc}=setup();await api.createTask(ctx,{...create,body:'  פתק  '});expect(rpc).toHaveBeenCalledWith(ctx,'create_task',create);});
 it.each(['NOT_FOUND','CONFLICT','FORBIDDEN','PROJECT_READ_ONLY','UNAUTHENTICATED'])('preserves %s from server',async code=>{const {api,rpc}=setup();rpc.mockResolvedValue({ok:false,error:{code,message:'בדיקה'}});expect(await api.updateTask(ctx,{id,expectedRevision:1,body:'פתק',dueDate:null})).toMatchObject({ok:false,error:{code}});});
 it.each([0,-1,1.5])('rejects invalid revision %s',async expectedRevision=>{const {api,rpc}=setup();expect(await api.deleteTask(ctx,{id,expectedRevision})).toMatchObject({ok:false,error:{code:'VALIDATION'}});expect(rpc).not.toHaveBeenCalled();});
});
