import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { detectMime, validateContent, zipEntryNames } from '../../../src/lib/storage/content';
import { checkFile, acceptFor, resolveMime } from '../../../src/components/upload/rules';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** A minimal stored (uncompressed) ZIP with the given entry names. */
function zip(names: string[]): Uint8Array {
  const locals: Buffer[] = [], centrals: Buffer[] = [];
  let offset = 0;
  for (const name of names) {
    const n = Buffer.from(name);
    const local = Buffer.alloc(30 + n.length); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(n.length, 26); n.copy(local, 30);
    const central = Buffer.alloc(46 + n.length); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(n.length, 28); central.writeUInt32LE(offset, 42); n.copy(central, 46);
    locals.push(local); centrals.push(central); offset += local.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(names.length, 8); end.writeUInt16LE(names.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, cd, end]));
}
const ole = () => { const b = Buffer.alloc(1024); Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(b); return new Uint8Array(b); };

describe('Office files', () => {
  it('reads ZIP entry names and rejects garbage', () => {
    expect(zipEntryNames(zip(['a.txt', 'b/c.xml']))).toEqual(['a.txt', 'b/c.xml']);
    expect(zipEntryNames(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
  it('detects docx and xlsx from their parts, not from the name', async () => {
    const docx = zip(['[Content_Types].xml', 'word/document.xml']);
    const xlsx = zip(['[Content_Types].xml', 'xl/workbook.xml']);
    expect(detectMime(docx)).toBe(DOCX);
    expect(detectMime(xlsx)).toBe(XLSX);
    expect(await validateContent(docx, DOCX)).toBe(true);
    expect(await validateContent(docx, XLSX)).toBe(false);
  });
  it('refuses a plain zip, and any package carrying macros', async () => {
    expect(detectMime(zip(['hello.txt']))).toBeNull();
    const macro = zip(['[Content_Types].xml', 'word/document.xml', 'word/vbaProject.bin']);
    expect(await validateContent(macro, DOCX)).toBe(false);
  });
  it('old binary Office files carrying a VBA project are refused', async () => {
    const withMacro = Buffer.concat([Buffer.from(ole()), Buffer.from('_VBA_PROJECT', 'utf16le')]);
    expect(await validateContent(new Uint8Array(withMacro), 'application/vnd.ms-excel')).toBe(false);
  });
  it('old binary Office files need the OLE signature and a declared Office type', async () => {
    expect(detectMime(ole(), 'application/msword')).toBe('application/msword');
    expect(detectMime(ole(), 'image/png')).toBeNull();
    expect(detectMime(ole())).toBeNull();
    expect(await validateContent(ole(), 'application/vnd.ms-excel')).toBe(true);
    expect(await validateContent(new Uint8Array(1024), 'application/vnd.ms-excel')).toBe(false);
  });
});

describe('client rules', () => {
  const file = (name: string, type = '') => ({ name, type, size: 1000 });
  it('documents accept Office files, diary attachments and covers do not', () => {
    expect(resolveMime(file('plan.docx'))).toBe(DOCX);
    expect(checkFile(file('a.xlsx'), 'document').ok).toBe(true);
    expect(checkFile(file('a.pptx'), 'diary').ok).toBe(false);
    expect(checkFile(file('a.doc'), 'cover').ok).toBe(false);
    expect(checkFile(file('a.exe'), 'document').ok).toBe(false);
  });
  it('the picker lists Office types only for documents', () => {
    expect(acceptFor('document')).toContain('.docx');
    expect(acceptFor('diary')).not.toContain('.docx');
  });
});
