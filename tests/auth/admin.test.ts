import {describe,expect,it,vi} from 'vitest';
import type {Db,RequestContext} from '../../src/types/contracts';
vi.mock('server-only',()=>({}));
import {createAuthAdmin,createManagedUser} from '../../src/lib/auth/admin';
const actor={userId:'2db95268-54da-42fa-bf62-2648ac3cc579',fullName:'בעלים בדוי',email:'owner@example.invalid',isOwner:true};
const target='6d54739e-32cf-44fb-9c7f-f26aef663d88';
const input={requestId:'2b9ffbe4-a9c6-4a47-a05a-d56337e7798c',email:'new@example.invalid',password:'fixture-password',fullName:'בדיקה חדשה'};
function fixture() {
  const rpc=vi.fn(async(name:string)=> name==='get_actor'?{data:actor,error:null}:name==='create_profile'?{data:{id:target,revision:1,passwordPending:true},error:null}:{data:null,error:null});
  const admin={createUser:vi.fn().mockResolvedValue({data:{user:{id:target}},error:null}),listUsers:vi.fn().mockResolvedValue({data:{users:[{id:target,email:input.email}]},error:null}),updateUserById:vi.fn().mockResolvedValue({data:{user:{id:target}},error:null})};
  const options={admin:vi.fn(()=>({auth:{admin}}) as unknown as Db)};
  const ctx:RequestContext={actor,db:{rpc} as unknown as Db,today:'2026-11-22'};
  return {rpc,admin,options,ctx};
}
describe('ניהול חשבונות: סדר פעולות וכשל חלקי',()=>{
  it('never sends a password to a database function',async()=>{
    const f=fixture();expect(await createManagedUser(f.ctx,input,f.options)).toMatchObject({ok:true,value:{userId:target}});
    expect(JSON.stringify(f.rpc.mock.calls)).not.toContain(input.password);
    expect(f.rpc).toHaveBeenCalledWith('create_profile',{input:{requestId:input.requestId,email:input.email,fullName:input.fullName}});
  });
  it('duplicate existing profile is never reset during creation retry',async()=>{
    const f=fixture();f.admin.createUser.mockResolvedValue({data:{user:null},error:{code:'email_exists'}});
    f.rpc.mockImplementation(async(name)=>name==='get_actor'?{data:actor,error:null}:{data:null,error:{message:'CONFLICT'}} as never);
    expect(await createManagedUser(f.ctx,input,f.options)).toMatchObject({ok:false,error:{code:'CONFLICT'}});
    expect(f.admin.updateUserById).not.toHaveBeenCalled();
  });
  it('password reset reports a revocation failure and can safely retry',async()=>{
    const f=fixture();let attempts=0;
    f.rpc.mockImplementation(async(name)=>name==='get_actor'?{data:actor,error:null}:{data:null,error:++attempts===1?{message:'network'}:null} as never);
    const service=createAuthAdmin(f.options);
    expect(await service.setPassword(f.ctx,{userId:target,password:input.password})).toMatchObject({ok:false,error:{code:'UNAVAILABLE'}});
    expect(await service.setPassword(f.ctx,{userId:target,password:input.password})).toEqual({ok:true,value:null});
    expect(f.admin.updateUserById).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(f.rpc.mock.calls)).not.toContain(input.password);
  });
  it('orphan-auth recovery remains finishable if password update fails after profile claim',async()=>{
    const f=fixture();let completed=false;
    f.admin.createUser.mockResolvedValue({data:{user:null},error:{code:'email_exists'}});
    f.rpc.mockImplementation(async(name)=>{
      if(name==='get_actor') return {data:actor,error:null};
      if(name==='create_profile')return {data:{id:target,revision:1,passwordPending:!completed},error:null};
      if(name==='complete_profile_creation')completed=true;
      return {data:null,error:null};
    });
    f.admin.updateUserById.mockResolvedValueOnce({data:{user:null},error:{message:'network'}}).mockResolvedValue({data:{user:{id:target}},error:null});
    expect(await createManagedUser(f.ctx,input,f.options)).toMatchObject({ok:false});
    expect(await createManagedUser(f.ctx,input,f.options)).toMatchObject({ok:true,value:{userId:target}});
    expect(completed).toBe(true);
    expect(f.rpc.mock.calls.some(([name])=>name==='revoke_user_sessions')).toBe(false);
  });
  it('lost completion response replays the receipt without resetting password again',async()=>{
    const f=fixture();let completed=false;
    f.admin.createUser.mockResolvedValue({data:{user:null},error:{code:'email_exists'}});
    f.rpc.mockImplementation(async(name)=>{
      if(name==='get_actor')return {data:actor,error:null};
      if(name==='create_profile')return {data:{id:target,revision:1,passwordPending:!completed},error:null};
      if(name==='complete_profile_creation'){completed=true;return {data:null,error:{message:'network'}} as never;}
      return {data:null,error:null};
    });
    expect(await createManagedUser(f.ctx,input,f.options)).toMatchObject({ok:false});
    expect(await createManagedUser(f.ctx,input,f.options)).toMatchObject({ok:true,value:{userId:target}});
    expect(f.admin.updateUserById).toHaveBeenCalledTimes(1);
    expect(f.rpc.mock.calls.filter(([name])=>name==='complete_profile_creation')).toHaveLength(1);
  });
});
