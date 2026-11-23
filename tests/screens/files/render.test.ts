import { describe, expect, it, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DocumentRow } from '@/types/contracts';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock('@/features/files/logic/actions', () => ({ createDocument: vi.fn(), setDocumentAccess: vi.fn(), setDocumentArchived: vi.fn() }));

import { FilesProvider } from '@/features/files/shared/FilesProvider';
import { FilesMobile } from '@/features/files/mobile/FilesMobile';
import { FilesDesktop } from '@/features/files/desktop/FilesDesktop';

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
    expect(html).toContain('/api/storage/files/file-a?download=1');
    expect(html).not.toContain('>גישה<');
    expect(html).not.toContain('לארכיון');
  });
  it('בן: גישה וארכיון', () => {
    const html = page({ canUpload: true, isOwner: true });
    expect(html).toContain('>גישה<');
    expect(html).toContain('לארכיון');
  });
  it('פרויקט שהסתיים או עובד: בלי העלאה, בלי העלאה', () => {
    const html = page({ canUpload: false, isOwner: false });
    expect(html).not.toContain('העלאת מסמך');
    expect(html).toContain('אין הרשאה להעלות');
    expect(html).toContain('פתיחה');
  });
  it('בטלפון מוצגים מסך קטגוריות בלי שורת לשוניות', () => {
    const html = page({ canUpload: true, isOwner: false });
    expect(html).toContain('קטגוריות');
    expect(html).not.toContain('role="tablist"');
  });
});
