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
