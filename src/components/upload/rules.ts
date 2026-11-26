// Client-side pre-checks for the shared upload component. The server re-validates size, content
// signature and format (P1.3); these only give fast, Hebrew feedback before any bytes are sent.
import type { FilePurpose } from '@/types/contracts';

const MB = 1024 * 1024;
export const MAX_BYTES: Record<FilePurpose, number> = { document: 50 * MB, diary: 25 * MB, cover: 25 * MB };
export const MAX_FILES: Record<FilePurpose, number> = { document: 20, diary: 20, cover: 1 };
export const ACCEPTED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const;
/** Office files: project documents only (never diary attachments or covers). No macro-enabled formats. */
export const OFFICE_MIME = [
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const;
const BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
  doc: OFFICE_MIME[0], docx: OFFICE_MIME[1], xls: OFFICE_MIME[2], xlsx: OFFICE_MIME[3], ppt: OFFICE_MIME[4], pptx: OFFICE_MIME[5],
};
const OFFICE_EXTENSIONS = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];

/** Mime types and extensions the file picker offers for a purpose. */
export const acceptFor = (purpose: FilePurpose): string =>
  [...ACCEPTED_MIME, '.heic', '.heif', '.dng', 'image/dng', 'image/x-adobe-dng', ...(purpose === 'document' ? [...OFFICE_MIME, ...OFFICE_EXTENSIONS.map(e => `.${e}`)] : [])].join(',');

/** Some phones report an empty type for HEIC, so fall back to the extension. */
export function resolveMime(file: { name: string; type: string }): string | null {
  if ((ACCEPTED_MIME as readonly string[]).includes(file.type) || (OFFICE_MIME as readonly string[]).includes(file.type)) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return BY_EXTENSION[ext] ?? null;
}

export type FileCheck = { ok: true; mime: string } | { ok: false; reason: string };

export function checkFile(file: { name: string; type: string; size: number }, purpose: FilePurpose): FileCheck {
  const mime = resolveMime(file);
  const isOffice = mime !== null && (OFFICE_MIME as readonly string[]).includes(mime);
  if (!mime || (isOffice && purpose !== 'document')) return { ok: false, reason: purpose === 'document' ? 'סוג הקובץ אינו נתמך. אפשר להעלות PDF, תמונה, Word, Excel או PowerPoint' : 'סוג הקובץ אינו נתמך. אפשר להעלות PDF או תמונה' };
  if (file.size === 0) return { ok: false, reason: 'הקובץ ריק' };
  if (file.size > MAX_BYTES[purpose]) return { ok: false, reason: `הקובץ גדול מדי. המגבלה היא ${MAX_BYTES[purpose] / MB}MB` };
  return { ok: true, mime };
}

export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / MB).toFixed(1)}MB`;
}

/**
 * Real type from the first bytes. Phones sometimes label a file by its name or picker type (".HEIC", "image/heic") after the
 * browser already converted it to JPEG; the server compares the declared type with the bytes and rejects any mismatch.
 * Only image and PDF signatures are sniffed; anything else (Office) keeps the declared type.
 */
export function sniffMime(head: Uint8Array): string | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...Array.from(head.subarray(from, to)));
  if (ascii(0, 5) === '%PDF-') return 'application/pdf';
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  if (head[0] === 137 && ascii(1, 4) === 'PNG') return 'image/png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(4, 8) === 'ftyp') {
    const boxEnd = new DataView(head.buffer, head.byteOffset, head.byteLength).getUint32(0);
    const brands = ascii(8, Math.min(boxEnd, head.length, 128));
    if (/heic|heix|hevc|hevx/.test(brands)) return 'image/heic';
    if (/mif1|msf1/.test(brands)) return 'image/heif';
  }
  return null;
}

/** The type to declare: the sniffed one when it is a different but allowed image/PDF type, else the resolved one. */
export function declaredMime(resolved: string | null, sniffed: string | null, purpose: FilePurpose): string | null {
  if (!sniffed) return resolved;
  if (sniffed === 'application/pdf' && purpose === 'cover') return resolved;
  const kind = (m: string | null) => (m?.startsWith('image/') ? 'image' : m);
  const resolvedIsOffice = resolved !== null && (OFFICE_MIME as readonly string[]).includes(resolved);
  if (resolvedIsOffice) return resolved;
  return kind(sniffed) === kind(resolved) || resolved === null || kind(resolved) === 'image' || resolved === 'application/pdf' ? sniffed : resolved;
}

/** Hebrew message for a failed storage request, by HTTP status. Never "no connection" for a server answer. */
export function messageForStatus(status: number): string {
  if (status === 413) return 'הקובץ גדול מדי להעלאה';
  if (status === 504 || status === 408) return 'עיבוד הקובץ לקח יותר מדי זמן. אפשר לנסות שוב';
  if (status === 401) return 'יש להתחבר מחדש';
  if (status >= 500) return 'השרת לא הצליח לעבד את הקובץ. אפשר לנסות שוב';
  return 'ההעלאה נכשלה. אפשר לנסות שוב';
}
