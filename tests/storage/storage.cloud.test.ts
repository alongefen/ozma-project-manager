import {randomUUID,randomBytes} from 'node:crypto';
import {Upload} from 'tus-js-client';
import {beforeAll,describe,expect,it,vi} from 'vitest';
import sharp from 'sharp';
import type {RequestContext,Result} from '../../src/types/contracts';
vi.mock('server-only',()=>({}));
import {createStorageService} from '../../src/lib/storage/service';
import {cloudActor,cloudClients,cloudEnvironment,cloudOwner} from '../auth/support/cloud';
function unwrap<T>(result:Result<T>):T {if(!result.ok)throw new Error(`בדיקת אחסון: ${result.error.code}`);return result.value;}
let ben:RequestContext,reader:Awaited<ReturnType<typeof cloudActor>>,projectId:string;
let service:ReturnType<typeof createStorageService>, png:Buffer;
beforeAll(async()=>{
  ben=await cloudOwner();reader=await cloudActor(ben,'file-reader');
  const {admin}=cloudClients();const env=cloudEnvironment();
  service=createStorageService({privileged:()=>admin,url:env.url,publishableKey:env.key});
  const project=await ben.db.rpc('create_project',{input:{requestId:randomUUID(),fields:{name:`P13 storage ${randomUUID()}`,businessName:'בדוי',siteAddress:'בדיקה',contact:{name:'בדוי',phone:'0',email:null,roleTitle:null},startDate:null,endDate:null,accessNotes:null}}});
  if(project.error)throw new Error('יצירת פרויקט אחסון נכשלה');projectId=(project.data as {id:string}).id;
  const membership=await ben.db.rpc('set_membership',{input:{userId:reader.ctx.actor.userId,projectId,role:'worker',expectedRevision:null}});
  if(membership.error)throw new Error('שיוך קורא נכשל');
  png=await sharp({create:{width:30,height:20,channels:3,background:'#abcdef'}}).png().toBuffer();
},120000);
async function upload(content:Buffer,declaredSize=content.length) {
  const result=unwrap(await service.beginUpload(ben,{purpose:'document',projectId,files:[{clientId:randomUUID(),name:'בדיקה.png',mime:'image/png',sizeBytes:declaredSize}]}));
  const target=unwrap(result[0].target);
  const {publicClient}=cloudClients();
  const uploaded=await publicClient().storage.from(target.bucket).uploadToSignedUrl(target.path,target.token,content,{contentType:'image/png'});
  expect(uploaded.error?.name).toBeUndefined();
  return target;
}
describe.sequential('Storage בפועל: מקור פרטי, הרשאה ופקיעת קישור',()=>{
  it('signed TUS upload resumes after interruption at a 6MiB chunk',async()=>{
    const large=await sharp(randomBytes(1600*1600*3),{raw:{width:1600,height:1600,channels:3}}).png().toBuffer();
    expect(large.length).toBeGreaterThan(6*1024*1024);
    const targets=unwrap(await service.beginUpload(ben,{purpose:'document',projectId,files:[{clientId:randomUUID(),name:'בדיקת המשך.png',mime:'image/png',sizeBytes:large.length}]}));const target=unwrap(targets[0].target);
    let resumed=false;
    await new Promise<void>((resolve,reject)=>{
      const task=new Upload(large,{endpoint:target.endpoint,chunkSize:6*1024*1024,retryDelays:[0,1000],uploadDataDuringCreation:false,removeFingerprintOnSuccess:true,
        headers:{apikey:target.publishableKey,'x-signature':target.token},metadata:{bucketName:target.bucket,objectName:target.path,contentType:'image/png'},
        onChunkComplete:(_size,done,total)=>{if(!resumed && done<total){resumed=true;void task.abort(false).then(()=>task.start());}},
        onError:()=>reject(new Error('העלאת TUS נכשלה; פרטי הבקשה אינם נרשמים')),onSuccess:()=>resolve()});task.start();
    });
    expect(resumed).toBe(true);
    expect(await service.finishUpload(ben,{fileId:target.fileId})).toMatchObject({ok:true});
    expect(Buffer.from(unwrap(await service.readBytes(ben,{fileId:target.fileId,variant:'original'})))).toEqual(large);
  },90000);

  it('private originals survive preview generation; direct reads, overwrite and delete are denied',async()=>{
    const target=await upload(png);
    const finished=unwrap(await service.finishUpload(ben,{fileId:target.fileId}));expect(finished.displayState).toBe('ready');
    const doc=await ben.db.rpc('create_document',{input:{projectId,fileId:target.fileId,category:'plans',access:{mode:'all'}}});expect(doc.error).toBeNull();
    expect(Buffer.from(unwrap(await service.readBytes(reader.ctx,{fileId:target.fileId,variant:'original'})))).toEqual(png);
    const display=unwrap(await service.readBytes(reader.ctx,{fileId:target.fileId,variant:'display'}));expect((await sharp(display).metadata()).format).toBe('jpeg');
    const {publicClient}=cloudClients();
    expect((await publicClient().storage.from('originals').download(target.path)).error).not.toBeNull();
    expect((await reader.ctx.db.storage.from('originals').download(target.path)).error).not.toBeNull();
    expect((await publicClient().storage.from('originals').uploadToSignedUrl(target.path,target.token,png,{upsert:true,contentType:'image/png'})).error).not.toBeNull();
    const removal=await reader.ctx.db.storage.from('originals').remove([target.path]);
    expect(removal.error!==null || removal.data?.length===0).toBe(true);
    expect(Buffer.from(unwrap(await service.readBytes(ben,{fileId:target.fileId,variant:'original'})))).toEqual(png);
  });
  it('wrong content and mismatched size become rejected and never yield a URL',async()=>{
    for(const [content,size] of [[Buffer.from('not-an-image'),12],[png,png.length+1]] as const) {
      const target=await upload(content,size);
      expect(await service.finishUpload(ben,{fileId:target.fileId})).toMatchObject({ok:false,error:{code:'VALIDATION'}});
      expect(await service.getSignedUrl(ben,{fileId:target.fileId,variant:'original',download:false})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});
    }
  });
  it('an unfinished upload can be completed after an initial missing-object failure',async()=>{
    const targets=unwrap(await service.beginUpload(ben,{purpose:'document',projectId,files:[{clientId:randomUUID(),name:'בדיקה.png',mime:'image/png',sizeBytes:png.length}]}));const target=unwrap(targets[0].target);
    expect(await service.finishUpload(ben,{fileId:target.fileId})).toMatchObject({ok:false,error:{code:'UNAVAILABLE'}});
    const {publicClient}=cloudClients();const sent=await publicClient().storage.from(target.bucket).uploadToSignedUrl(target.path,target.token,png,{contentType:'image/png'});expect(sent.error).toBeNull();
    expect(await service.finishUpload(ben,{fileId:target.fileId})).toMatchObject({ok:true});
  });
  it('revocation blocks new URLs immediately and the issued URL expires',async()=>{
    const target=await upload(png);unwrap(await service.finishUpload(ben,{fileId:target.fileId}));
    const doc=await ben.db.rpc('create_document',{input:{projectId,fileId:target.fileId,category:'plans',access:{mode:'all'}}});expect(doc.error).toBeNull();
    const signed=unwrap(await service.getSignedUrl(reader.ctx,{fileId:target.fileId,variant:'original',download:false}));expect(signed.expiresInSeconds).toBe(60);
    expect((await fetch(signed.url)).ok).toBe(true);
    const id=(doc.data as {id:string}).id;
    expect((await ben.db.rpc('set_document_access',{input:{id,expectedRevision:1,access:{mode:'owner'}}})).error).toBeNull();
    expect(await service.getSignedUrl(reader.ctx,{fileId:target.fileId,variant:'original',download:false})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});
    expect(await service.readBytes(reader.ctx,{fileId:target.fileId,variant:'original'})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});
    await new Promise(resolve=>setTimeout(resolve,61000));
    expect((await fetch(signed.url,{headers:{'Cache-Control':'no-cache'}})).ok).toBe(false);
  },90000);
});
