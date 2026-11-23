import {beforeEach,describe,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const {createPlatform,getContext,rpc}=vi.hoisted(()=>({createPlatform:vi.fn(),getContext:vi.fn(),rpc:vi.fn()}));
vi.mock('../../../src/lib/auth/platform',()=>({createPlatform}));
import {createEntry} from '../../../src/features/diary/logic/actions';
const id='10000000-0000-4000-8000-000000000001';
const input={requestId:id,projectId:id,workDate:'2026-11-20',body:'בדוי',fileIds:[]};
beforeEach(()=>{vi.resetAllMocks();createPlatform.mockResolvedValue({auth:{getContext},rpc});});
describe('Diary server actions',()=>{
 it('derives identity only from the authenticated server context',async()=>{const ctx={actor:{userId:id},db:{},today:'2026-11-22'};getContext.mockResolvedValue({ok:true,value:ctx});rpc.mockResolvedValue({ok:true,value:{id,revision:1}});expect(await createEntry(input)).toMatchObject({ok:true});expect(rpc).toHaveBeenCalledWith(ctx,'create_entry',input);});
 it('does not write without an active session',async()=>{getContext.mockResolvedValue({ok:false,error:{code:'UNAUTHENTICATED',message:'כניסה'}});expect(await createEntry(input)).toMatchObject({ok:false,error:{code:'UNAUTHENTICATED'}});expect(rpc).not.toHaveBeenCalled();});
 it('does not disclose provider exceptions',async()=>{createPlatform.mockRejectedValue(new Error('secret fixture'));const result=await createEntry(input);expect(result).toMatchObject({ok:false,error:{code:'UNAVAILABLE'}});expect(JSON.stringify(result)).not.toContain('secret fixture');});
});
