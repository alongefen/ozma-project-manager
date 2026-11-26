import {describe,it,expect} from 'vitest';
import {extractPreview,MAX_DNG_BYTES} from '@/components/upload/dng/parser';
import {inspectJpeg} from '@/components/upload/dng/jpeg';
import {isDngInput} from '@/components/upload/dng/prepare';
import {acceptFor,checkFile} from '@/components/upload/rules';
import {dng,jpegHead} from './fixtures';

describe('DNG input, JPEG output only',()=>{
 it('offers DNG input without allowing stored RAW',()=>{
  expect(acceptFor('diary')).toContain('.dng');
  for(const type of ['', 'application/octet-stream','image/dng','image/x-adobe-dng'])expect(isDngInput({name:'photo.DNG',type})).toBe(true);
  expect(isDngInput({name:'a.jpg',type:'image/jpeg'})).toBe(false);
  expect(checkFile({name:'a.dng',type:'image/dng',size:100},'diary').ok).toBe(false);
 });
 it.each([true,false])('extracts only the bounded JPEG in endian=%s',async little=>{
  const p=await extractPreview(dng(undefined,little,6));expect(p.orientation).toBe(6);
  expect(new Uint8Array(await p.jpeg.arrayBuffer())).toEqual(jpegHead());
 });
 it('does not use the uploaded-output size limit for local source',async()=>{
  const source=dng();const large=new File([source,new Uint8Array(26*1024*1024)],'large.DNG');
  expect((await extractPreview(large)).jpeg.size).toBe(jpegHead().length);
 });
 it('rejects a spoofed DNG tag, malformed offsets and cycles',async()=>{
  const original=new Uint8Array(await dng().arrayBuffer());
  for(const mutate of [(v:DataView)=>v.setUint16(82,123,true),(v:DataView)=>v.setUint32(54,0xffffffff,true),(v:DataView)=>v.setUint32(94,8,true)]){
   const b=original.slice();mutate(new DataView(b.buffer));await expect(extractPreview(new File([b],'bad.dng'))).rejects.toThrow();
  }
  await expect(extractPreview(new File(['not TIFF'],'bad.dng'))).rejects.toThrow();
 });
 it('rejects oversized sources before reading any bytes',async()=>{
  const source={size:MAX_DNG_BYTES+1,slice(){throw Error('must not read')}} as unknown as Blob;
  await expect(extractPreview(source)).rejects.toThrow('100');
 });
 it('checks actual JPEG dimensions, EOI and pixel bounds',async()=>{
  expect(await inspectJpeg(new Blob([jpegHead()]))).toMatchObject({width:1600,height:1200});
  await expect(inspectJpeg(new Blob([jpegHead().slice(0,-2)]))).rejects.toThrow();
  const b=jpegHead();b[7]=255;b[8]=255;b[9]=255;b[10]=255;
  await expect(inspectJpeg(new Blob([b]))).rejects.toThrow();
 });
});
