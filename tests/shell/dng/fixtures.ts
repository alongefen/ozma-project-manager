/** Synthetic TIFF container, never customer media. The JPEG can be a generated image or header-only parser fixture. */
export function dng(jpeg: Uint8Array = jpegHead(), little = true, orientation = 1): File {
  const offset = 128, bytes = new Uint8Array(offset + jpeg.length), v = new DataView(bytes.buffer);
  const u16 = (o: number, n: number) => v.setUint16(o, n, little), u32 = (o: number, n: number) => v.setUint32(o, n, little);
  bytes.set(little ? [73,73] : [77,77]); u16(2,42);u32(4,8);u16(8,7);
  const entries = [[256,4,1,1600],[257,4,1,1200],[259,3,1,7],[273,4,1,offset],[274,3,1,orientation],[279,4,1,jpeg.length],[50706,1,4,0]];
  entries.forEach(([tag,type,count,value],i)=>{const p=10+i*12;u16(p,tag);u16(p+2,type);u32(p+4,count);if(tag===50706)bytes.set([1,6,0,0],p+8);else if(type===3)u16(p+8,value);else u32(p+8,value);});
  bytes.set(jpeg,offset);return new File([bytes], 'synthetic.DNG', {type:'application/octet-stream'});
}
export function jpegHead(): Uint8Array<ArrayBuffer> { return Uint8Array.from([255,216,255,192,0,17,8,4,176,6,64,3,1,17,0,2,17,0,3,17,0,255,218,0,2,255,217]); }
