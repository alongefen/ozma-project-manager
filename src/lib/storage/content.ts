import 'server-only';
import sharp from 'sharp';
import { PDFDocument } from '@cantoo/pdf-lib';
import { createRequire } from 'node:module';

export function detectMime(bytes: Uint8Array): string | null {
  const b = Buffer.from(bytes);
  if (b.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  if (b.subarray(4, 8).toString() === 'ftyp') {
    const brands = b.subarray(8, Math.min(b.readUInt32BE(0), b.length, 128)).toString();
    if (/heic|heix|hevc|hevx/.test(brands)) return 'image/heic';
    if (/mif1|msf1/.test(brands)) return 'image/heif';
  }
  return null;
}
export async function validateContent(bytes: Uint8Array, mime: string): Promise<boolean> {
  try {
    if (mime === 'application/pdf') { const pdf = await PDFDocument.load(bytes); return pdf.getPageCount() > 0; }
    if (mime === 'image/heic' || mime === 'image/heif') {
      // Validate the complete ISO-BMFF container independently of preview support.
      const buffer = Buffer.from(bytes);
      let offset = 0;
      const boxes = new Set<string>();
      while (offset < buffer.length) {
        if (buffer.length - offset < 8) return false;
        let size = buffer.readUInt32BE(offset);
        const type = buffer.toString('ascii', offset + 4, offset + 8);
        let header = 8;
        if (size === 1) {
          if (buffer.length - offset < 16) return false;
          const wide = buffer.readBigUInt64BE(offset + 8);
          if (wide > BigInt(Number.MAX_SAFE_INTEGER)) return false;
          size = Number(wide); header = 16;
        } else if (size === 0) size = buffer.length - offset;
        if (size <= header || size > buffer.length - offset) return false;
        boxes.add(type); offset += size;
      }
      return detectMime(bytes) === mime && boxes.has('meta') && boxes.has('mdat');
    }
    await sharp(bytes, { failOn: 'error', limitInputPixels: 100_000_000 }).raw().toBuffer();
    return true;
  } catch { return false; }
}
export async function renderDisplay(bytes: Uint8Array, mime: string): Promise<Uint8Array> {
  let input = Buffer.from(bytes);
  if (mime === 'image/heic' || mime === 'image/heif') {
    const convert = createRequire(import.meta.url)('heic-convert') as (options: { buffer: Buffer; format: 'JPEG'; quality: number }) => Promise<ArrayBuffer>;
    input = Buffer.from(await convert({ buffer: input, format: 'JPEG', quality: 1 }));
  }
  const result = await sharp(input, { failOn: 'error', limitInputPixels: 100_000_000 }).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
  if (result.length > 5 * 1024 * 1024) throw new Error('עותק התצוגה גדול מדי');
  return result;
}
