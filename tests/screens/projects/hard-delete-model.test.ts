import { describe, expect, it, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DocumentRow } from '@/types/contracts';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock('@/features/projects/logic/actions', () => ({ hardDelete: vi.fn(), previewHardDelete: vi.fn() }));
vi.mock('@/features/files/logic/actions', () => ({ createDocument: vi.fn(), setDocumentAccess: vi.fn(), setDocumentArchived: vi.fn() }));
import { canOfferHardDelete, deletionSummary, nameMatches } from '@/features/projects/shared/hard-delete-model';
import { DocActions } from '@/features/files/shared/DocCard';

const doc = (archived: boolean): DocumentRow => ({ id: 'a', projectId: 'p', category: 'plans', uploadedByName: 'דנה', createdAt: '2026-11-23T08:00:00.000Z', archived, revision: 1, file: { id: 'f', name: 'a.pdf', mime: 'application/pdf', sizeBytes: 1, displayState: 'none' } });
const menu = (isOwner: boolean, archived: boolean) => renderToStaticMarkup(h(DocActions, { doc: doc(archived), isOwner, onDone() {}, onAccess() {}, onArchive() {}, onDelete() {} }));

describe('מחיקה סופית: כללי תצוגה', () => {
  it('רק בעלים, ורק על פריט שבוטל, בארכיון או שהסתיים', () => {
    expect(canOfferHardDelete(false, 'project', { archived: true })).toBe(false);
    expect(canOfferHardDelete(true, 'project', {})).toBe(false);
    expect(canOfferHardDelete(true, 'project', { archived: true })).toBe(true);
    expect(canOfferHardDelete(true, 'project', { completed: true })).toBe(true);
    expect(canOfferHardDelete(true, 'document', { archived: false })).toBe(false);
    expect(canOfferHardDelete(true, 'document', { archived: true })).toBe(true);
    expect(canOfferHardDelete(true, 'entry', { cancelled: false })).toBe(false);
    expect(canOfferHardDelete(true, 'transaction', { cancelled: true })).toBe(true);
  });
  it('התפריט של מסמך: הפעולה מופיעה רק לבעלים על מסמך בארכיון', () => {
    expect(menu(true, true)).toContain('>מחיקה סופית<');
    expect(menu(true, false)).not.toContain('מחיקה סופית');
    expect(menu(false, true)).not.toContain('מחיקה סופית');
  });
  it('הסיכום מציג את הספירות, והשם חייב להתאים', () => {
    const text = deletionSummary('project', 'בית ספר', { reports: 3, documents: 1, transactions: 2, files: 5 }).join('\n');
    expect(text).toContain('3 דיווחי יומן'); expect(text).toContain('1 מסמך'); expect(text).toContain('2 תנועות כספיות'); expect(text).toContain('5 קבצים באחסון');
    expect(nameMatches(' בית ספר ', 'בית ספר')).toBe(true);
    expect(nameMatches('בית', 'בית ספר')).toBe(false);
    expect(nameMatches('', '')).toBe(false);
    expect(nameMatches('x', null)).toBe(false);
  });
});
