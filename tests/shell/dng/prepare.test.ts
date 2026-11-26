import {describe,it,expect,vi,afterEach} from 'vitest';
import {prepareDng} from '@/components/upload/dng/prepare';
class FakeWorker {
 static last:FakeWorker;
 onmessage:((event:unknown)=>void)|null=null;
 onerror:(()=>void)|null=null;
 terminate=vi.fn();postMessage=vi.fn();
 constructor(){FakeWorker.last=this;}
}
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
describe('disposable DNG worker',()=>{
 it('returns a new JPEG and closes its worker',async()=>{
  vi.stubGlobal('Worker',FakeWorker);const f=new File(['raw'],'photo.DNG'),p=prepareDng(f,new AbortController().signal);
  FakeWorker.last.onmessage!({data:{ok:true,blob:new Blob(['jpeg'],{type:'image/jpeg'})}});
  const out=await p;expect(out.name).toBe('photo.jpg');expect(out.type).toBe('image/jpeg');expect(FakeWorker.last.terminate).toHaveBeenCalledOnce();
 });
 it('cancels active work and terminates the decoder',async()=>{
  vi.stubGlobal('Worker',FakeWorker);const c=new AbortController(),p=prepareDng(new File(['x'],'a.dng'),c.signal);c.abort();
  await expect(p).rejects.toMatchObject({name:'AbortError'});expect(FakeWorker.last.terminate).toHaveBeenCalledOnce();
 });
 it('times out instead of continuing or uploading RAW',async()=>{
  vi.useFakeTimers();vi.stubGlobal('Worker',FakeWorker);const p=prepareDng(new File(['x'],'a.dng'),new AbortController().signal);const rejection=expect(p).rejects.toThrow('יותר מדי זמן');await vi.advanceTimersByTimeAsync(10000);await rejection;expect(FakeWorker.last.terminate).toHaveBeenCalledOnce();
 });
 it('shows a useful failure when Worker support is unavailable',async()=>{
  vi.stubGlobal('Worker',undefined);await expect(prepareDng(new File(['x'],'a.dng'),new AbortController().signal)).rejects.toThrow('JPEG');
 });
});
