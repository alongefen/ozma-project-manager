import { describe, expect, it } from 'vitest';
import { checkFile, formatSize, MAX_BYTES, MAX_FILES, resolveMime } from '@/components/upload/rules';

const MB = 1024 * 1024;
describe('upload rules', () => {
  it('uses the agreed limits: 50MB documents, 25MB attachments and cover, one cover image', () => {
    expect(MAX_BYTES.document).toBe(50 * MB);
    expect(MAX_BYTES.diary).toBe(25 * MB);
    expect(MAX_BYTES.cover).toBe(25 * MB);
    expect(MAX_FILES.cover).toBe(1);
    expect(MAX_FILES.diary).toBe(20);
  });
  it('accepts PDF and images, including HEIC reported without a type', () => {
    expect(checkFile({ name: 'תוכנית A-12 rev3.pdf', type: 'application/pdf', size: 1000 }, 'document')).toEqual({ ok: true, mime: 'application/pdf' });
    expect(resolveMime({ name: 'IMG_0001.HEIC', type: '' })).toBe('image/heic');
  });
  it('rejects unsupported, empty and oversize files with a Hebrew reason', () => {
    expect(checkFile({ name: 'a.exe', type: 'application/x-msdownload', size: 5 }, 'document')).toMatchObject({ ok: false, reason: expect.stringContaining('אינו נתמך') });
    expect(checkFile({ name: 'a.pdf', type: 'application/pdf', size: 0 }, 'document')).toMatchObject({ ok: false });
    expect(checkFile({ name: 'a.pdf', type: 'application/pdf', size: 26 * MB }, 'diary')).toMatchObject({ ok: false, reason: expect.stringContaining('25MB') });
    expect(checkFile({ name: 'a.pdf', type: 'application/pdf', size: 26 * MB }, 'document')).toMatchObject({ ok: true });
  });
  it('formats sizes', () => {
    expect(formatSize(500)).toBe('1KB');
    expect(formatSize(3 * MB)).toBe('3.0MB');
  });
});

import { declaredMime, messageForStatus, sniffMime } from '@/components/upload/rules';
const bytes = (...n: number[]) => Uint8Array.from([...n, ...new Array(32).fill(0)]);
const ftyp = (brand: string) => Uint8Array.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, ...Array.from(brand).map(c => c.charCodeAt(0)), ...new Array(20).fill(0)]);
describe('content sniffing for the declared type', () => {
  it('recognises jpeg, png, pdf, heic and heif from the first bytes', () => {
    expect(sniffMime(bytes(0xff, 0xd8, 0xff))).toBe('image/jpeg');
    expect(sniffMime(bytes(137, 80, 78, 71))).toBe('image/png');
    expect(sniffMime(bytes(0x25, 0x50, 0x44, 0x46, 0x2d))).toBe('application/pdf');
    expect(sniffMime(ftyp('heic'))).toBe('image/heic');
    expect(sniffMime(ftyp('mif1'))).toBe('image/heif');
    expect(sniffMime(bytes(1, 2, 3))).toBeNull();
  });
  it('a ".HEIC" file whose bytes are JPEG is declared as JPEG (the server rejects a mismatch)', () => {
    expect(declaredMime('image/heic', 'image/jpeg', 'diary')).toBe('image/jpeg');
  });
  it('keeps the resolved type when nothing was sniffed, for Office files, and never makes a PDF cover', () => {
    expect(declaredMime('image/jpeg', null, 'diary')).toBe('image/jpeg');
    expect(declaredMime('application/vnd.ms-excel', 'application/pdf', 'document')).toBe('application/vnd.ms-excel');
    expect(declaredMime('image/jpeg', 'application/pdf', 'cover')).toBe('image/jpeg');
  });
  it('uses the sniffed type for a file with no usable name or type', () => {
    expect(declaredMime(null, 'image/jpeg', 'diary')).toBe('image/jpeg');
  });
  it('explains platform errors instead of "no connection"', () => {
    expect(messageForStatus(504)).toContain('יותר מדי זמן');
    expect(messageForStatus(500)).toContain('השרת');
  });
});

describe('long ftyp box', () => {
  it('finds heic listed as a compatible brand after byte 32, like the server', () => {
    const head = new Uint8Array(64); head.set([0, 0, 0, 48, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x69, 0x66, 0x31], 0); head.set([0x68, 0x65, 0x69, 0x63], 40);
    expect(sniffMime(head)).toBe('image/heic');
  });
});
