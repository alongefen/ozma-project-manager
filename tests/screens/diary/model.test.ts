import { describe, expect, it } from 'vitest';
import type { DiaryRow } from '@/types/contracts';
import { groupByDate, mergePage, parseDraft, parseFilter, reportUrl, isDate } from '@/features/diary/shared/model';

const P = '11111111-1111-4111-8111-111111111111';
const row = (id: string, workDate: string): DiaryRow => ({
  id, projectId: P, projectName: 'פרויקט', workDate: workDate as DiaryRow['workDate'], body: 'x', reporterId: P, reporterName: 'דנה',
  enteredAt: '2026-11-23T08:00:00.000Z' as DiaryRow['enteredAt'], editedAt: null, editedByName: null, cancelledAt: null, files: [], revision: 1, canCorrect: true, canMoveOrCancel: false,
});

describe('טיוטת דיווח', () => {
  it('מקבלת טופס תקין וגוזמת רווחים', () => {
    const r = parseDraft({ projectId: P, workDate: '2026-11-23', body: '  עבודה  ' });
    expect(r).toMatchObject({ ok: true, body: 'עבודה' });
  });
  it('דוחה פרויקט חסר, תאריך לא קיים וטקסט ריק', () => {
    const r = parseDraft({ projectId: '', workDate: '2026-02-31', body: '   ' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['body', 'projectId', 'workDate']);
  });
  it('דוחה טקסט ארוך מדי', () => {
    expect(parseDraft({ projectId: P, workDate: '2026-11-23', body: 'א'.repeat(20001) }).ok).toBe(false);
  });
});

describe('סינון מהכתובת', () => {
  it('מתעלם מערכים פגומים וממקרה שבו התאריכים הפוכים', () => {
    expect(parseFilter({ project: 'x', from: '2026-13-01', to: ['a'] })).toEqual({});
    expect(parseFilter({ project: P, from: '2026-11-10', to: '2026-11-01' })).toEqual({ projectId: P });
    expect(parseFilter({ from: '2026-11-01', to: '2026-11-10' })).toEqual({ from: '2026-11-01', to: '2026-11-10' });
  });
  it('isDate בודק תאריך אמיתי', () => { expect(isDate('2026-02-29')).toBe(false); expect(isDate('2028-02-29')).toBe(true); });
});

describe('רשימה', () => {
  it('מקבצת לפי תאריך עבודה ושומרת סדר', () => {
    const g = groupByDate([row('a', '2026-11-23'), row('b', '2026-11-23'), row('c', '2026-11-22')]);
    expect(g.map(x => [x.label, x.rows.length])).toEqual([['23.11.2026', 2], ['22.11.2026', 1]]);
  });
  it('מיזוג עמוד לא חוזר על שורה קיימת', () => {
    expect(mergePage([row('a', '2026-11-23')], [row('a', '2026-11-23'), row('b', '2026-11-22')]).map(r => r.id)).toEqual(['a', 'b']);
  });
});

describe('כתובת ה-PDF', () => {
  it('יום, חלק והורדה', () => {
    expect(reportUrl({ kind: 'day', projectId: P, date: '2026-11-23' })).toBe(`/api/reports/diary?kind=day&projectId=${P}&date=2026-11-23`);
    expect(reportUrl({ kind: 'day', projectId: P, date: '2026-11-23' }, { part: 2, download: true })).toContain('part=2&download=1');
    expect(reportUrl({ kind: 'entry', entryId: P })).toBe(`/api/reports/diary?kind=entry&entryId=${P}`);
  });
});
