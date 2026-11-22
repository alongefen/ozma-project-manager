import {randomBytes,randomUUID} from 'node:crypto';
import {beforeAll,describe,expect,it,vi} from 'vitest';
import type {Db,RequestContext} from '../../src/types/contracts';
vi.mock('server-only',()=>({}));
import {createAuthAdmin} from '../../src/lib/auth/admin';
import {cloudClients,cloudOwner} from './support/cloud';
let ben:RequestContext;
beforeAll(async()=>{ben=await cloudOwner();});
async function orphan(){
  const {admin}=cloudClients();const email=`p13-retry-${randomUUID()}@example.invalid`,initialPassword=randomBytes(32).toString('base64url');
  const created=await admin.auth.admin.createUser({email,password:initialPassword,email_confirm:true});
  if(created.error || !created.data.user)throw new Error('יצירת חשבון בדוי ל-retry נכשלה');
  return {admin,userId:created.data.user.id,input:{requestId:randomUUID(),email,fullName:'חשבון בדוי לניסיון חוזר',password:randomBytes(32).toString('base64url')}};
}
function provider(admin:Db,update:ReturnType<typeof vi.fn>):Db {
  return {auth:{admin:{createUser:admin.auth.admin.createUser.bind(admin.auth.admin),listUsers:admin.auth.admin.listUsers.bind(admin.auth.admin),updateUserById:update}}} as unknown as Db;
}
describe.sequential('Auth creation receipt integration through the service',()=>{
  it('retries a failed password update after a committed profile without claiming another request',async()=>{
    const f=await orphan();
    const update=vi.fn().mockResolvedValueOnce({data:{user:null},error:{message:'simulated network failure'}}).mockImplementation(f.admin.auth.admin.updateUserById.bind(f.admin.auth.admin));
    const service=createAuthAdmin({admin:()=>provider(f.admin,update)});
    expect(await service.createUser(ben,f.input)).toMatchObject({ok:false,error:{code:'UNAVAILABLE'}});
    const before=await ben.db.rpc('create_profile',{input:{requestId:f.input.requestId,email:f.input.email,fullName:f.input.fullName}});
    expect((before.data as {passwordPending:boolean}).passwordPending).toBe(true);
    expect(await service.createUser(ben,f.input)).toEqual({ok:true,value:{userId:f.userId}});
    expect(update).toHaveBeenCalledTimes(2);
    const login=await cloudClients().publicClient().auth.signInWithPassword({email:f.input.email,password:f.input.password});expect(login.error?.code).toBeUndefined();
    expect(await service.createUser(ben,{...f.input,requestId:randomUUID()})).toMatchObject({ok:false,error:{code:'CONFLICT'}});
    expect(update).toHaveBeenCalledTimes(2);
    const after=await ben.db.rpc('create_profile',{input:{requestId:f.input.requestId,email:f.input.email,fullName:f.input.fullName}});
    expect((after.data as {passwordPending:boolean}).passwordPending).toBe(false);
  });
  it('lost completion response cannot reset a subsequently changed password or revoke a new session',async()=>{
    const f=await orphan();const update=vi.fn(f.admin.auth.admin.updateUserById.bind(f.admin.auth.admin));
    let dropped=false;
    const db=new Proxy(ben.db,{get(target,key){
      if(key==='rpc')return async(...args:Parameters<Db['rpc']>)=>{const result=await target.rpc(...args);if(args[0]==='complete_profile_creation' && !result.error && !dropped){dropped=true;return {data:null,error:{message:'simulated lost completion response'}};}return result;};
      const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
    }});
    const service=createAuthAdmin({admin:()=>provider(f.admin,update)});
    expect(await service.createUser({...ben,db},f.input)).toMatchObject({ok:false,error:{code:'UNAVAILABLE'}});
    expect(dropped).toBe(true);
    const changedPassword=randomBytes(32).toString('base64url');
    const changed=await f.admin.auth.admin.updateUserById(f.userId,{password:changedPassword});expect(changed.error?.code).toBeUndefined();
    const client=cloudClients().publicClient();const signed=await client.auth.signInWithPassword({email:f.input.email,password:changedPassword});expect(signed.error?.code).toBeUndefined();
    expect(await service.createUser(ben,f.input)).toEqual({ok:true,value:{userId:f.userId}});
    expect(update).toHaveBeenCalledTimes(1);
    const actor=await client.rpc('get_actor',{input:{}});expect((actor.data as {userId:string}).userId).toBe(f.userId);
    const again=await cloudClients().publicClient().auth.signInWithPassword({email:f.input.email,password:changedPassword});expect(again.error?.code).toBeUndefined();
  });
});
