import 'server-only';
import sharp from 'sharp';
import { PDFDocument } from '@cantoo/pdf-lib';
import { createRequire } from 'node:module';

const DOC = 'application/msword', XLS = 'application/vnd.ms-excel', PPT = 'application/vnd.ms-powerpoint';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
export const OFFICE_BINARY = [DOC, XLS, PPT];
export const OFFICE_XML = [DOCX, XLSX, PPTX];
const OLE_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

/** File names inside a ZIP, read from its central directory (no extraction). Null when it is not a well-formed ZIP. */
export function zipEntryNames(bytes: Uint8Array): string[] | null {
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minEnd = Math.max(0, b.length - 22 - 65535);
  let eocd = -1;
  for (let i = b.length - 22; i >= minEnd; i--) if (b.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return null;
  const count = b.readUInt16LE(eocd + 10);
  let offset = b.readUInt32LE(eocd + 16);
  const names: string[] = [];
  for (let n = 0; n < count; n++) {
    if (offset + 46 > b.length || b.readUInt32LE(offset) !== 0x02014b50) return null;
    const nameLength = b.readUInt16LE(offset + 28), extra = b.readUInt16LE(offset + 30), comment = b.readUInt16LE(offset + 32);
    if (offset + 46 + nameLength > b.length) return null;
    names.push(b.toString('utf8', offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extra + comment;
  }
  return names;
}

/** Office Open XML kind from its parts: word/, xl/ or ppt/ plus [Content_Types].xml. */
function officeXmlMime(bytes: Uint8Array): string | null {
  const names = zipEntryNames(bytes);
  if (!names || !names.includes('[Content_Types].xml')) return null;
  if (names.some(n => n.startsWith('word/'))) return DOCX;
  if (names.some(n => n.startsWith('xl/'))) return XLSX;
  if (names.some(n => n.startsWith('ppt/'))) return PPTX;
  return null;
}

/**
 * Detects the real type from the bytes. Old binary Office files (doc, xls, ppt) share one OLE signature, so for those
 * the declared type is trusted only when it is one of the three and the signature matches (`declared`).
 */
export function detectMime(bytes: Uint8Array, declared?: string): string | null {
  const b = Buffer.from(bytes);
  if (b.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  if (b.length >= 8 && b.subarray(0, 8).equals(OLE_SIGNATURE)) return declared && OFFICE_BINARY.includes(declared) ? declared : null;
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return officeXmlMime(bytes);
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
    if (OFFICE_BINARY.includes(mime)) {
      const view = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      // Directory names are UTF-16: a VBA project means the file carries macros.
      return view.subarray(0, 8).equals(OLE_SIGNATURE) && view.length > 512 && !view.includes(Buffer.from('_VBA_PROJECT', 'utf16le')) && !view.includes(Buffer.from('VBA', 'utf16le'));
    }
    if (OFFICE_XML.includes(mime)) {
      const names = zipEntryNames(bytes);
      // Macro-enabled content is refused even when the extension is a plain one.
      return !!names && detectMime(bytes) === mime && !names.some(n => /vbaProject\.bin$/i.test(n));
    }
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
