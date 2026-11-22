import {randomUUID} from 'node:crypto';
import {beforeAll,describe,expect,it,vi} from 'vitest';
import sharp from 'sharp';
import type {Db,RequestContext,Result} from '../../src/types/contracts';
vi.mock('server-only',()=>({}));
import {createStorageService} from '../../src/lib/storage/service';
import {cloudActor,cloudClients,cloudEnvironment,cloudOwner} from '../auth/support/cloud';
const unwrap=<T>(r:Result<T>):T=>{if(!r.ok)throw new Error(`בדיקת retry: ${r.error.code}`);return r.value;};
let ben:RequestContext,manager:Awaited<ReturnType<typeof cloudActor>>,projectId:string,png:Buffer;
beforeAll(async()=>{
  ben=await cloudOwner();manager=await cloudActor(ben,'terminal-replay');
  const p=await ben.db.rpc('create_project',{input:{requestId:randomUUID(),fields:{name:`P13 retry ${randomUUID()}`,businessName:'בדוי',siteAddress:'בדיקה',contact:{name:'בדוי',phone:'0',email:null,roleTitle:null},startDate:null,endDate:null,accessNotes:null}}});
  if(p.error)throw new Error('יצירת פרויקט retry נכשלה');projectId=(p.data as {id:string}).id;
  const assignment=await ben.db.rpc('set_membership',{input:{userId:manager.ctx.actor.userId,projectId,role:'manager',expectedRevision:null}});if(assignment.error)throw new Error('שיוך retry נכשל');
  png=await sharp({create:{width:20,height:20,channels:3,background:'#123456'}}).png().toBuffer();
});
function storage(privileged:()=>Db){const env=cloudEnvironment();return createStorageService({privileged,url:env.url,publishableKey:env.key});}
async function upload(service:ReturnType<typeof storage>,ctx:RequestContext,content=png){
  const result=unwrap(await service.beginUpload(ctx,{purpose:'document',projectId,files:[{clientId:randomUUID(),name:'בדיקת חזרה.png',mime:'image/png',sizeBytes:content.length}]}));const target=unwrap(result[0].target);
  const sent=await cloudClients().publicClient().storage.from(target.bucket).uploadToSignedUrl(target.path,target.token,content,{contentType:'image/png'});expect(sent.error?.name).toBeUndefined();return target.fileId;
}
describe.sequential('Storage terminal receipt integration through the service',()=>{
  it('lost finish response returns the same ready reference without further storage operations; attachment closes replay',async()=>{
    const {admin}=cloudClients();let dropped=false;
    const proxied=new Proxy(admin,{get(target,key){
      if(key==='rpc')return async(...args:Parameters<Db['rpc']>)=>{const result=await target.rpc(...args);if(args[0]==='system_finish_upload' && !result.error && !dropped){dropped=true;return {data:null,error:{message:'simulated lost finish response'}};}return result;};
      const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
    }});
    const provider=vi.fn(()=>proxied);const service=storage(provider);const fileId=await upload(service,manager.ctx);
    expect(await service.finishUpload(manager.ctx,{fileId})).toMatchObject({ok:false,error:{code:'UNAVAILABLE'}});expect(dropped).toBe(true);
    const calls=provider.mock.calls.length;
    const first=unwrap(await service.finishUpload(manager.ctx,{fileId}));const second=unwrap(await service.finishUpload(manager.ctx,{fileId}));expect(first).toEqual(second);expect(provider.mock.calls.length).toBe(calls);
    const doc=await manager.ctx.db.rpc('create_document',{input:{projectId,fileId,category:'plans',access:{mode:'owner'}}});expect(doc.error).toBeNull();
    expect(await service.finishUpload(manager.ctx,{fileId})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});
    expect(await service.readBytes(manager.ctx,{fileId,variant:'original'})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});
    expect(provider.mock.calls.length).toBe(calls);
  });
  it('rejected replay remains rejected and revoked sessions cannot replay ready results',async()=>{
    const {admin}=cloudClients();const provider=vi.fn(()=>admin);const service=storage(provider);
    const rejected=await upload(service,manager.ctx,Buffer.from('invalid image fixture'));
    expect(await service.finishUpload(manager.ctx,{fileId:rejected})).toMatchObject({ok:false,error:{code:'VALIDATION'}});
    const calls=provider.mock.calls.length;
    expect(await service.finishUpload(manager.ctx,{fileId:rejected})).toMatchObject({ok:false,error:{code:'VALIDATION'}});expect(provider.mock.calls.length).toBe(calls);
    const ready=await upload(service,manager.ctx);expect(await service.finishUpload(manager.ctx,{fileId:ready})).toMatchObject({ok:true});
    const revoked=await ben.db.rpc('revoke_user_sessions',{input:{id:manager.ctx.actor.userId}});expect(revoked.error).toBeNull();
    expect(await service.finishUpload(manager.ctx,{fileId:ready})).toMatchObject({ok:false,error:{code:'UNAUTHENTICATED'}});
  });
});
