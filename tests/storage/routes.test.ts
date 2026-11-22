import {beforeEach,describe,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const platform=vi.hoisted(()=>({create:vi.fn()}));
vi.mock('../../src/lib/auth/platform',()=>({createPlatform:platform.create}));
import {POST as begin} from '../../src/app/api/storage/uploads/route';
import {POST as complete} from '../../src/app/api/storage/uploads/[id]/complete/route';
import {GET as download} from '../../src/app/api/storage/files/[id]/route';
beforeEach(()=>vi.clearAllMocks());
describe('נתיבי HTTP: CSRF, קונטקסט שרת והסתרת מידע',()=>{
  it('cross-origin and missing-origin writes are denied before authentication',async()=>{
    for(const headers of [{},{origin:'https://evil.invalid'},{origin:'https://app.invalid','sec-fetch-site':'cross-site'}] as Record<string,string>[]) {
      const request=new Request('https://app.invalid/api/storage/uploads',{method:'POST',headers});
      expect((await begin(request)).status).toBe(403);
    }
    expect(platform.create).not.toHaveBeenCalled();
  });
  it('an unauthenticated caller cannot begin, complete or read a file',async()=>{
    platform.create.mockResolvedValue({auth:{getContext:vi.fn().mockResolvedValue({ok:false,error:{code:'UNAUTHENTICATED',message:'נדרשת כניסה'}})}});
    const post=new Request('https://app.invalid/api/storage/uploads',{method:'POST',headers:{origin:'https://app.invalid'}});const params=Promise.resolve({id:'fixture'});
    for(const response of [await begin(post),await complete(post,{params}),await download(new Request('https://app.invalid/api/storage/files/fixture'),{params})]) {
      expect(response.status).toBe(401);expect(response.headers.get('cache-control')).toBe('private, no-store');
    }
  });
  it('completion only accepts file ID from the route, never actor/session from body',async()=>{
    const ctx={actor:{userId:'server-derived'}};const finishUpload=vi.fn().mockResolvedValue({ok:true,value:{id:'file-id'}});
    platform.create.mockResolvedValue({auth:{getContext:vi.fn().mockResolvedValue({ok:true,value:ctx})},storage:{finishUpload}});
    const request=new Request('https://app.invalid/api/storage/uploads/file-id/complete',{method:'POST',headers:{origin:'https://app.invalid','content-type':'application/json'},body:JSON.stringify({actorId:'forged',sessionId:'forged'})});
    expect((await complete(request,{params:Promise.resolve({id:'file-id'})})).status).toBe(200);
    expect(finishUpload).toHaveBeenCalledWith(ctx,{fileId:'file-id'});
  });
  it('authorized download redirects with no-store and rejects invalid variants',async()=>{
    const getSignedUrl=vi.fn().mockResolvedValue({ok:true,value:{url:'https://storage.invalid/signed',expiresInSeconds:60}});
    platform.create.mockResolvedValue({auth:{getContext:vi.fn().mockResolvedValue({ok:true,value:{}})},storage:{getSignedUrl}});
    const params=Promise.resolve({id:'file-id'});
    const response=await download(new Request('https://app.invalid/api/storage/files/file-id?variant=original'),{params});
    expect(response.status).toBe(302);expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect((await download(new Request('https://app.invalid/api/storage/files/file-id?variant=unknown'),{params})).status).toBe(400);
    expect(getSignedUrl).toHaveBeenCalledTimes(1);
  });
});
