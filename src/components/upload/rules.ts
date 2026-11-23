// Client-side pre-checks for the shared upload component. The server re-validates size, content
// signature and format (P1.3); these only give fast, Hebrew feedback before any bytes are sent.
import type { FilePurpose } from '@/types/contracts';

const MB = 1024 * 1024;
export const MAX_BYTES: Record<FilePurpose, number> = { document: 50 * MB, diary: 25 * MB, cover: 25 * MB };
export const MAX_FILES: Record<FilePurpose, number> = { document: 20, diary: 20, cover: 1 };
export const ACCEPTED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const;
const BY_EXTENSION: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' };

/** Some phones report an empty type for HEIC, so fall back to the extension. */
export function resolveMime(file: { name: string; type: string }): string | null {
  if ((ACCEPTED_MIME as readonly string[]).includes(file.type)) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return BY_EXTENSION[ext] ?? null;
}

export type FileCheck = { ok: true; mime: string } | { ok: false; reason: string };

export function checkFile(file: { name: string; type: string; size: number }, purpose: FilePurpose): FileCheck {
  const mime = resolveMime(file);
  if (!mime) return { ok: false, reason: 'סוג הקובץ אינו נתמך. אפשר להעלות PDF או תמונה' };
  if (file.size === 0) return { ok: false, reason: 'הקובץ ריק' };
  if (file.size > MAX_BYTES[purpose]) return { ok: false, reason: `הקובץ גדול מדי. המגבלה היא ${MAX_BYTES[purpose] / MB}MB` };
  return { ok: true, mime };
}

export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / MB).toFixed(1)}MB`;
}
