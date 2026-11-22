import {describe,expect,it,vi} from 'vitest';
import sharp from 'sharp';
import type {Db,RequestContext} from '../../src/types/contracts';
vi.mock('server-only',()=>({}));
import {createStorageService} from '../../src/lib/storage/service';
import {detectMime,renderDisplay,validateContent} from '../../src/lib/storage/content';
const userId='2db95268-54da-42fa-bf62-2648ac3cc579', fileId='6d54739e-32cf-44fb-9c7f-f26aef663d88', projectId='ad244885-d074-46c9-b57a-d620a903ba95',sessionId='bca55850-9259-4e3d-9ad1-358a269bd159';
function fixture(bytes:Uint8Array=new Uint8Array([1,2,3])) {
  const actor={userId,fullName:'בדיקה',email:'test@example.invalid',isOwner:false};
  const pending={state:'pending',fileRef:null,fileId,projectId,uploadedBy:userId,purpose:'diary',bucket:'originals',path:`${projectId}/${fileId}`,name:'בדיקה.png',declaredMime:'image/png',declaredSize:bytes.length};
  const rpc=vi.fn(async(name:string)=>({error:null,data:name==='get_actor'?actor:name==='get_pending_upload'?pending:name==='begin_upload'?[{clientId:fileId,fileId,bucket:'originals',path:pending.path}]:{bucket:'originals',path:pending.path,name:pending.name}}));
  const getClaims=vi.fn().mockResolvedValue({data:{claims:{sub:userId,session_id:sessionId}},error:null});
  const ctx:RequestContext={actor,db:{rpc,auth:{getClaims}} as unknown as Db,today:'2026-11-22'};
  const storage={download:vi.fn().mockResolvedValue({data:new Blob([Buffer.from(bytes)]),error:null}),upload:vi.fn().mockResolvedValue({error:null}),createSignedUrl:vi.fn().mockResolvedValue({data:{signedUrl:'https://example.invalid/signed'},error:null}),createSignedUploadUrl:vi.fn().mockResolvedValue({data:{token:'fixture-token'},error:null})};
  const finish=vi.fn().mockResolvedValue({data:{id:fileId,name:pending.name,mime:pending.declaredMime,sizeBytes:bytes.length,displayState:'ready'},error:null});
  const privileged=vi.fn(()=>({storage:{from:vi.fn(()=>storage)},rpc:finish}) as unknown as Db);
  const service=createStorageService({privileged,url:'https://izjmvyguzbampoasvnru.supabase.co',publishableKey:'public-fixture'});
  return {ctx,rpc,pending,getClaims,storage,finish,privileged,service};
}
describe('אחסון: הרשאה, תוכן וניסיון חוזר',()=>{
  it('terminal ready replay returns the prior file without downloading or rewriting it',async()=>{
    const f=fixture();const fileRef={id:fileId,name:'בדיקה.png',mime:'image/png',sizeBytes:3,displayState:'ready'};
    f.rpc.mockResolvedValue({data:{...f.pending,state:'ready',fileRef},error:null} as never);
    expect(await f.service.finishUpload(f.ctx,{fileId})).toEqual({ok:true,value:fileRef});
    expect(f.privileged).not.toHaveBeenCalled();expect(f.getClaims).not.toHaveBeenCalled();
    expect(f.rpc).toHaveBeenCalledWith('get_pending_upload',{input:{fileId}});
  });
  it('terminal rejected replay stays a validation failure without privileged access',async()=>{
    const f=fixture();f.rpc.mockResolvedValue({data:{...f.pending,state:'rejected',fileRef:null},error:null} as never);
    expect(await f.service.finishUpload(f.ctx,{fileId})).toMatchObject({ok:false,error:{code:'VALIDATION'}});
    expect(f.privileged).not.toHaveBeenCalled();
  });
  it.each(['UNAUTHENTICATED','NOT_FOUND','FORBIDDEN'])('terminal replay respects fresh database denial %s',async(code)=>{
    const f=fixture();f.rpc.mockResolvedValue({data:null,error:{message:code}} as never);
    expect(await f.service.finishUpload(f.ctx,{fileId})).toMatchObject({ok:false,error:{code}});
    expect(f.privileged).not.toHaveBeenCalled();
  });

  it('preview conversion failure retains the original as ready with a failed preview',async()=>{
    const png=await sharp({create:{width:10,height:10,channels:3,background:'#abcdef'}}).png().toBuffer();
    const f=fixture(png);
    const service=createStorageService({privileged:f.privileged,url:'https://example.invalid',publishableKey:'public',renderDisplay:async()=>{throw new Error('decoder unavailable');}});
    expect(await service.finishUpload(f.ctx,{fileId})).toMatchObject({ok:true});
    expect(f.finish.mock.calls[0][1].input).toMatchObject({state:'ready',displayState:'failed',displayPath:null});
    expect(f.storage.upload).not.toHaveBeenCalled();
  });
  it('retry accepts an already uploaded identical preview without overwriting it',async()=>{
    const png=await sharp({create:{width:10,height:10,channels:3,background:'#abcdef'}}).png().toBuffer();
    const preview=await renderDisplay(png,'image/png');
    const f=fixture(png);
    f.storage.upload.mockResolvedValue({error:{statusCode:'409'}});
    f.storage.download.mockResolvedValueOnce({data:new Blob([png]),error:null}).mockResolvedValueOnce({data:new Blob([Buffer.from(preview)]),error:null});
    expect(await f.service.finishUpload(f.ctx,{fileId})).toMatchObject({ok:true});
    expect(f.finish.mock.calls[0][1].input).toMatchObject({state:'ready',displayState:'ready',displayPath:`${projectId}/${fileId}.jpg`});
    expect(f.storage.upload).toHaveBeenCalledTimes(1);
  });

  it('denied reads never reach privileged storage',async()=>{
    const f=fixture();f.rpc.mockResolvedValue({data:null,error:{message:'NOT_FOUND'}} as never);
    expect(await f.service.readBytes(f.ctx,{fileId,variant:'original'})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});
    expect(await f.service.getSignedUrl(f.ctx,{fileId,variant:'original',download:false})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});
    expect(f.privileged).not.toHaveBeenCalled();
  });
  it('each signed URL checks permission anew and expires in exactly 60 seconds',async()=>{
    const f=fixture();expect(await f.service.getSignedUrl(f.ctx,{fileId,variant:'original',download:true})).toMatchObject({ok:true,value:{expiresInSeconds:60}});
    expect(f.storage.createSignedUrl).toHaveBeenCalledWith(f.pending.path,60,{download:f.pending.name});
    f.rpc.mockResolvedValue({data:null,error:{message:'NOT_FOUND'}} as never);
    expect(await f.service.getSignedUrl(f.ctx,{fileId,variant:'original',download:true})).toMatchObject({ok:false});
    expect(f.storage.createSignedUrl).toHaveBeenCalledTimes(1);
  });
  it('upload signing disables overwrite',async()=>{
    const f=fixture();expect(await f.service.beginUpload(f.ctx,{purpose:'diary',projectId,files:[{clientId:fileId,name:'בדיקה.png',mime:'image/png',sizeBytes:3}]})).toMatchObject({ok:true});
    expect(f.storage.createSignedUploadUrl).toHaveBeenCalledWith(f.pending.path,{upsert:false});
  });
  it('wrong file content is rejected in database and never marked ready',async()=>{
    const f=fixture();expect(await f.service.finishUpload(f.ctx,{fileId})).toMatchObject({ok:false,error:{code:'VALIDATION'}});
    expect(f.finish).toHaveBeenCalledWith('system_finish_upload',{input:{fileId,actorId:userId,sessionId,state:'rejected'}});
  });
  it('a failed download remains pending for a later retry',async()=>{
    const f=fixture();f.storage.download.mockResolvedValue({data:null,error:{message:'network'}});
    expect(await f.service.finishUpload(f.ctx,{fileId})).toMatchObject({ok:false,error:{code:'UNAVAILABLE'}});
    expect(f.finish).not.toHaveBeenCalled();
  });
  it('claims of a different user cannot finalize someone else upload',async()=>{
    const f=fixture();f.getClaims.mockResolvedValue({data:{claims:{sub:projectId,session_id:sessionId}},error:null});
    expect(await f.service.finishUpload(f.ctx,{fileId})).toMatchObject({ok:false,error:{code:'UNAUTHENTICATED'}});
    expect(f.privileged).not.toHaveBeenCalled();
  });
  it('oversized declared diary is rejected by the RPC before signing',async()=>{
    const f=fixture();f.rpc.mockResolvedValue({data:null,error:{message:'LIMIT'}} as never);
    expect(await f.service.beginUpload(f.ctx,{purpose:'diary',projectId,files:[{clientId:fileId,name:'large.png',mime:'image/png',sizeBytes:26*1024*1024}]})).toMatchObject({ok:false,error:{code:'LIMIT'}});
    expect(f.privileged).not.toHaveBeenCalled();
  });
  it('valid image bytes are preserved while preview is JPEG without metadata',async()=>{
    const png=await sharp({create:{width:2000,height:1000,channels:3,background:'#336699'}}).png().toBuffer();
    const f=fixture(png);expect(await f.service.finishUpload(f.ctx,{fileId})).toMatchObject({ok:true});
    const payload=f.finish.mock.calls[0][1].input;
    expect(payload).toMatchObject({actorId:userId,sessionId,sizeBytes:png.length,mime:'image/png',state:'ready',displayState:'ready'});
    expect(payload.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(f.storage.upload.mock.calls[0][2]).toEqual({contentType:'image/jpeg',upsert:false});
    const preview=await renderDisplay(png,'image/png');const metadata=await sharp(preview).metadata();
    expect(metadata).toMatchObject({format:'jpeg',width:1600,height:800});expect(metadata.exif).toBeUndefined();
  });
  it('magic bytes alone do not make a broken PNG or PDF valid',async()=>{
    const png=Uint8Array.from([137,80,78,71,13,10,26,10]);
    expect(detectMime(png)).toBe('image/png');expect(await validateContent(png,'image/png')).toBe(false);
    expect(await validateContent(Buffer.from('%PDF-1.7\nnot a PDF'),'application/pdf')).toBe(false);
  });
});
