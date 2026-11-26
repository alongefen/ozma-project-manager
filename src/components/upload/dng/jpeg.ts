import {DNG_ERROR} from './parser';
const invalid = (): never => { throw new Error(DNG_ERROR); };

/** Bound JPEG header parsing and remove APP1 before browser decode so orientation is applied exactly once. */
export async function inspectJpeg(blob: Blob): Promise<{jpeg: Blob; width: number; height: number; orientation?: number}> {
  if (blob.size < 4 || blob.size > 16 * 1024 * 1024) invalid();
  const b = new Uint8Array(await blob.slice(0, Math.min(blob.size, 1024 * 1024)).arrayBuffer());
  const tail = new Uint8Array(await blob.slice(-2).arrayBuffer());
  if (b[0] !== 255 || b[1] !== 216 || tail[0] !== 255 || tail[1] !== 217) invalid();
  const v = new DataView(b.buffer), pieces: BlobPart[] = []; let pos = 2, kept = 0, width = 0, height = 0, orientation: number | undefined;
  let scan = false;
  while (pos + 4 <= b.length) {
    if (b[pos++] !== 255) invalid();
    while (b[pos] === 255) pos++;
    const marker = b[pos++];
    if (marker === 0xda) { scan = true; break; }
    if (marker === 0xd9 || marker === 0 || marker === 0xd8) invalid();
    const start = pos - 2, size = v.getUint16(pos), end = pos + size;
    if (size < 2 || end > b.length) invalid();
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4,0xc8,0xcc].includes(marker)) {
      if (size < 8) invalid();
      height = v.getUint16(pos + 3); width = v.getUint16(pos + 5);
    }
    if (marker === 0xe1) {
      // EXIF orientation only. Never traverse GPS, maker notes or arbitrary EXIF pointers.
      if (size >= 16 && String.fromCharCode(...b.subarray(pos+2,pos+8)) === 'Exif\0\0') {
        const base = pos + 8, order = v.getUint16(base), le = order === 0x4949;
        if ((order !== 0x4949 && order !== 0x4d4d) || v.getUint16(base+2,le) !== 42) invalid();
        const dir = base + v.getUint32(base+4,le);
        if (dir < base || dir + 2 > end) invalid();
        const count = v.getUint16(dir,le);
        if (count > 512 || dir + 2 + count * 12 + 4 > end) invalid();
        for(let i=0;i<count;i++) { const p=dir+2+i*12;if(v.getUint16(p,le)===274){
          if(v.getUint16(p+2,le)!==3 || v.getUint32(p+4,le)!==1)invalid();
          orientation=v.getUint16(p+8,le);if(orientation<1||orientation>8)invalid();
        }}
      }
      pieces.push(blob.slice(kept,start));kept=end;
    }
    pos=end;
  }
  if (!scan || !width || !height || width * height > 50_000_000 || Math.max(width,height) < 1600) invalid();
  pieces.push(blob.slice(kept));
  return {jpeg:new Blob(pieces,{type:'image/jpeg'}),width,height,orientation};
}
