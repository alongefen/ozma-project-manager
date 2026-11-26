export const MAX_DNG_BYTES = 100 * 1024 * 1024;
export const DNG_ERROR = 'לא ניתן להמיר את קובץ ה־DNG הזה. יש לייצא אותו כתמונת JPEG ולבחור אותה';
const invalid = (): never => { throw new Error(DNG_ERROR); };
export type Preview = { jpeg: Blob; orientation: number };

/** Classic TIFF only. Read directories, never the RAW payload or arbitrary EXIF. */
export async function extractPreview(file: Blob): Promise<Preview> {
  if (file.size > MAX_DNG_BYTES) throw new Error('קובץ ה־DNG גדול מדי להמרה במכשיר. המגבלה היא 100MB');
  if (file.size < 8) invalid();
  let readBytes = 0;
  const read = async (offset: number, size: number) => {
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(size) || offset < 0 || size < 0 || offset + size > file.size || (readBytes += size) > 1024 * 1024) invalid();
    return new DataView(await file.slice(offset, offset + size).arrayBuffer());
  };
  const head = await read(0, 8), order = head.getUint16(0);
  if (order !== 0x4949 && order !== 0x4d4d) invalid();
  const le = order === 0x4949;
  if (head.getUint16(2, le) !== 42) invalid();
  const seen = new Set<number>(), candidates: { offset: number; size: number; area: number; orientation: number }[] = [];
  let dng = false;
  async function directory(offset: number, depth: number, inherited: number) {
    if (!offset) return;
    if (depth > 6 || seen.size >= 32 || seen.has(offset)) invalid();
    seen.add(offset);
    const n = (await read(offset, 2)).getUint16(0, le);
    if (n > 512) invalid();
    const view = await read(offset + 2, n * 12 + 4);
    const values = new Map<number, number[]>();
    const wanted = new Set([256,257,259,273,274,279,330,513,514,50706]);
    const widths: Record<number, number> = {1:1,2:1,3:2,4:4,5:8,6:1,7:1,8:2,9:4,10:8,11:4,12:8,13:4};
    for (let i = 0; i < n; i++) {
      const p = i * 12, tag = view.getUint16(p, le), type = view.getUint16(p + 2, le), count = view.getUint32(p + 4, le), width = widths[type];
      if (!width || count * width > file.size) invalid();
      const size = count * width, dataOffset = size <= 4 ? offset + 2 + p + 8 : view.getUint32(p + 8, le);
      if (dataOffset + size > file.size) invalid();
      if (!wanted.has(tag)) continue;
      if (![1,3,4,13].includes(type) || count < 1 || count > (tag === 330 ? 32 : tag === 50706 ? 4 : 1) || values.has(tag)) invalid();
      const data = await read(dataOffset, size);
      values.set(tag, Array.from({length:count}, (_,j) => width === 1 ? data.getUint8(j) : width === 2 ? data.getUint16(j * 2,le) : data.getUint32(j * 4,le)));
      if (tag === 50706) {
        if (depth !== 0 || type !== 1 || count !== 4 || data.getUint8(0) !== 1) invalid();
        dng = true;
      }
    }
    const val = (tag: number) => values.get(tag)?.[0];
    const orientation = val(274) ?? inherited;
    if (orientation < 1 || orientation > 8) invalid();
    const width = val(256) ?? 0, height = val(257) ?? 0;
    const start = val(513) ?? (val(259) === 7 ? val(273) : undefined), size = val(514) ?? (val(259) === 7 ? val(279) : undefined);
    if (start !== undefined && size !== undefined && width > 0 && height > 0 && width * height <= 50_000_000 && Math.max(width,height) >= 1600 && size > 0 && size <= 16 * 1024 * 1024 && start + size <= file.size) candidates.push({offset:start,size,area:width*height,orientation});
    for (const sub of values.get(330) ?? []) await directory(sub, depth + 1, orientation);
    await directory(view.getUint32(n * 12, le), depth + 1, inherited);
  }
  await directory(head.getUint32(4, le), 0, 1);
  if (!dng || !candidates.length) invalid();
  const best = candidates.sort((a,b) => b.area - a.area || a.size - b.size)[0];
  return {jpeg:file.slice(best.offset,best.offset+best.size,'image/jpeg'),orientation:best.orientation};
}
