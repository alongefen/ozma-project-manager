import { describe, expect, it } from 'vitest';
import type { DocumentRow } from '@/types/contracts';
import { accessSummary, countsOf, emptyAccess, parseAccess, toggleUser, visibleDocuments, thumbUrl, extensionLabel } from '@/features/files/shared/model';

const u1 = '11111111-1111-4111-8111-111111111111';
const u2 = '22222222-2222-4222-8222-222222222222';
const candidates = [{ userId: u1, fullName: 'דנה כהן' }, { userId: u2, fullName: 'רן לוי' }];
const doc = (id: string, category: DocumentRow['category'], name: string): DocumentRow => ({
  id, projectId: 'p', category, uploadedByName: 'x', createdAt: '2026-11-23T08:00:00.000Z', archived: false, revision: 1,
  file: { id: `f${id}`, name, mime: 'application/pdf', sizeBytes: 10, displayState: 'none' },
});

describe('בחירת גישה', () => {
  it('בלי בחירה נדחה', () => {
    expect(parseAccess(emptyAccess, candidates)).toEqual({ ok: false, error: 'יש לבחור מי רשאי לראות את המסמך' });
  });
  it('בן בלבד וכולם עוברים בלי רשימה', () => {
    expect(parseAccess({ mode: 'owner', userIds: [u1] }, candidates)).toEqual({ ok: true, access: { mode: 'owner' } });
    expect(parseAccess({ mode: 'all', userIds: [] }, candidates)).toEqual({ ok: true, access: { mode: 'all' } });
  });
  it('נבחרים: חובה לפחות אחד, רק משויכים, בלי כפילויות', () => {
    expect(parseAccess({ mode: 'selected', userIds: [] }, candidates).ok).toBe(false);
    expect(parseAccess({ mode: 'selected', userIds: ['99999999-9999-4999-8999-999999999999'] }, candidates).ok).toBe(false);
    expect(parseAccess({ mode: 'selected', userIds: [u1, u1] }, candidates)).toEqual({ ok: true, access: { mode: 'selected', userIds: [u1] } });
  });
  it('סימון והסרה', () => {
    expect(toggleUser([u1], u2)).toEqual([u1, u2]);
    expect(toggleUser([u1, u2], u1)).toEqual([u2]);
  });
  it('סיכום גישה', () => {
    expect(accessSummary(undefined, candidates)).toBeNull();
    expect(accessSummary({ mode: 'selected', userIds: [u1, 'x'] }, candidates)).toBe('דנה כהן, 1 לא משויכים עוד');
  });
});

describe('רשימות', () => {
  const items = [doc('1', 'plans', 'Plan-A.pdf'), doc('2', 'plans', 'b.pdf'), doc('3', 'renderings', 'View.pdf')];
  it('ספירה לפי קטגוריה', () => expect(countsOf(items)).toEqual({ specification: 0, plans: 2, additional_plans: 0, renderings: 1 }));
  it('סינון לפי קטגוריה וחיפוש', () => {
    expect(visibleDocuments(items, 'plans', '').map(d => d.id)).toEqual(['1', '2']);
    expect(visibleDocuments(items, null, 'view').map(d => d.id)).toEqual(['3']);
    expect(visibleDocuments(items, 'plans', 'view')).toEqual([]);
  });
});

describe('תצוגה מקדימה', () => {
  it('תמונה מוכנה מקבלת כתובת תצוגה דרך נתיב ההרשאות; PDF, HEIC שנכשל וקבצים אחרים לא', () => {
    expect(thumbUrl({ id: 'f1', mime: 'image/jpeg', displayState: 'ready' })).toBe('/api/storage/files/f1?variant=display');
    expect(thumbUrl({ id: 'f2', mime: 'application/pdf', displayState: 'none' })).toBeNull();
    expect(thumbUrl({ id: 'f3', mime: 'image/heic', displayState: 'failed' })).toBeNull();
  });
  it('תווית הסיומת על האריח', () => {
    expect(extensionLabel({ name: 'plan.final.pdf', mime: 'application/pdf' })).toBe('PDF');
    expect(extensionLabel({ name: 'noext', mime: 'image/heic' })).toBe('HEIC');
  });
});
