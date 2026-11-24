import { describe, expect, it, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DocumentRow } from '@/types/contracts';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock('@/features/files/logic/actions', () => ({ createDocument: vi.fn(), setDocumentAccess: vi.fn(), setDocumentArchived: vi.fn() }));

import { FilesProvider } from '@/features/files/shared/FilesProvider';
import { FilesMobile } from '@/features/files/mobile/FilesMobile';
import { FilesDesktop } from '@/features/files/desktop/FilesDesktop';
import { DocActions } from '@/features/files/shared/DocCard';

const row = (id: string, over: Partial<DocumentRow> = {}): DocumentRow => ({
  id, projectId: '11111111-1111-4111-8111-111111111111', category: 'plans', uploadedByName: 'דנה', createdAt: '2026-11-23T08:00:00.000Z',
  archived: false, revision: 1, file: { id: `file-${id}`, name: `plan-${id}.pdf`, mime: 'application/pdf', sizeBytes: 2048, displayState: 'none' }, ...over,
});

function page(opts: { canUpload: boolean; isOwner: boolean }) {
  return renderToStaticMarkup(h(FilesProvider, {
    projectId: 'p', active: [row('a', { access: opts.isOwner ? { mode: 'all' } : undefined })], archived: [], candidates: [],
    ...opts,
  }, h(FilesMobile), h(FilesDesktop)));
}

describe('הרשאות במסך', () => {
  it('מנהל: העלאה, פתיחה והורדה, בלי גישה וארכיון', () => {
    const html = page({ canUpload: true, isOwner: false });
    expect(html).toContain('העלאת מסמך');
    expect(html).toContain('href="/api/storage/files/file-a"');
    expect(html).not.toContain('גישה:');
    expect(html).not.toContain('לארכיון');
    const menu = renderToStaticMarkup(h(DocActions, { doc: row('a'), isOwner: false, onDone() {}, onAccess() {}, onArchive() {} }));
    expect(menu).toContain('פתיחה');
    expect(menu).toContain('/api/storage/files/file-a?download=1');
    expect(menu).not.toContain('>הרשאות<');
    expect(menu).not.toContain('העבר לארכיון');
  });
  it('בן: גישה וארכיון', () => {
    const html = page({ canUpload: true, isOwner: true });
    expect(html).toContain('גישה: כל המשויכים');
    expect(html).toContain('לארכיון');
    const menu = renderToStaticMarkup(h(DocActions, { doc: row('a'), isOwner: true, onDone() {}, onAccess() {}, onArchive() {} }));
    expect(menu).toContain('>הרשאות<');
    expect(menu).toContain('>העבר לארכיון<');
    expect(renderToStaticMarkup(h(DocActions, { doc: row('a', { archived: true }), isOwner: true, onDone() {}, onAccess() {}, onArchive() {} }))).toContain('>החזרה<');
  });
  it('פרויקט שהסתיים או עובד: בלי העלאה, בלי העלאה', () => {
    const html = page({ canUpload: false, isOwner: false });
    expect(html).not.toContain('העלאת מסמך');
    expect(html).toContain('אין הרשאה להעלות');
    expect(html).toContain('href="/api/storage/files/file-a"'); // still can open
  });
  it('בטלפון: שורת סינון (חיפוש, קטגוריה) והרשימה, בלי שורת לשוניות ובלי תיבת סימון לארכיון', () => {
    const html = page({ canUpload: true, isOwner: true });
    expect(html).toContain('role="search"');
    expect(html).toContain('הכל (1)');
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain('type="checkbox"');
    expect(html).not.toContain('הצגת הארכיון');
  });
  it('כל מסמך מציג אריח תצוגה בגודל קבוע: תמונה עצלה, PDF קטן מצייר עמוד ראשון, PDF גדול ו-Word מקבלים אריח סוג', () => {
    const file = (id: string, name: string, mime: string, sizeBytes: number, displayState: 'none' | 'ready' = 'none') => ({ id, name, mime, sizeBytes, displayState }) as DocumentRow['file'];
    const html = renderToStaticMarkup(h(FilesProvider, { projectId: 'p', active: [
      row('a'),
      row('b', { file: file('fb', 'site.jpg', 'image/jpeg', 1, 'ready') }),
      row('c', { file: file('fc', 'big.pdf', 'application/pdf', 20 * 1024 * 1024) }),
      row('d', { file: file('fd', 'spec.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 1000) }),
    ], archived: [], candidates: [], canUpload: false, isOwner: false }, h(FilesMobile)));
    expect(html).toContain('src="/api/storage/files/fb?variant=display"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('fl-thumb ui-skel'); // small PDF: first page is drawn in the browser
    expect(html).toContain('class="fl-thumb__tile is-pdf"'); // 20MB PDF keeps the tile
    expect(html).toContain('class="fl-thumb__tile is-word"');
    expect(html).toContain('DOCX');
  });
  it('הארכיון הוא כפתור בסוף אותה שורה של החיפוש והסינון', () => {
    const html = page({ canUpload: true, isOwner: true });
    const row = html.slice(html.indexOf('class="fl-tools"'));
    expect(row.indexOf('type="search"')).toBeLessThan(row.indexOf('aria-haspopup="listbox"'));
    expect(row.indexOf('aria-haspopup="listbox"')).toBeLessThan(row.indexOf('aria-pressed="false"'));
    expect(row).toMatch(/<button[^>]*fl-tools__archive[^>]*>לארכיון/);
  });
});
