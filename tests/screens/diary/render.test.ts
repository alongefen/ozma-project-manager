import { describe, expect, it, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DiaryRow } from '@/types/contracts';
import type { DiaryScreen } from '@/features/diary/shared/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }));
vi.mock('@/features/diary/logic/actions', () => ({ listEntries: vi.fn(), cancelEntry: vi.fn(), createEntry: vi.fn(), correctEntry: vi.fn(), moveEntry: vi.fn() }));
vi.mock('@/features/reports/logic/actions', () => ({ planReport: vi.fn() }));

import { DiaryMobile } from '@/features/diary/mobile/DiaryMobile';
import { DiaryDesktop } from '@/features/diary/desktop/DiaryDesktop';

const P = '11111111-1111-4111-8111-111111111111';
const row = (over: Partial<DiaryRow> = {}): DiaryRow => ({
  id: '22222222-2222-4222-8222-222222222222', projectId: P, projectName: 'בית ספר', workDate: '2026-11-23', body: 'יצקנו תקרה', reporterId: P, reporterName: 'דנה כהן',
  enteredAt: '2026-11-23T08:00:00.000Z', editedAt: null, editedByName: null, cancelledAt: null, files: [], revision: 1, canCorrect: false, canMoveOrCancel: false, ...over,
});
const screen = (over: Partial<DiaryScreen> = {}): DiaryScreen => ({
  rows: [row()], nextCursor: null, filter: {}, projects: [{ id: P, name: 'בית ספר' }], canReport: true, today: '2026-11-23', basePath: '/diary', ...over,
});
const html = (s: DiaryScreen) => renderToStaticMarkup(h('div', null, h(DiaryMobile, { screen: s }), h(DiaryDesktop, { screen: s, title: 'יומן עבודה' })));

describe('מסכי היומן', () => {
  it('מי שרשאי לדווח רואה כפתור דיווח חדש; הדפסה לכל אחד', () => {
    const out = html(screen());
    expect(out).toContain('דיווח חדש');
    expect(out).toContain('/api/reports/diary?kind=entry');
    expect(out).toContain('הדפסה או PDF לפי תאריך');
  });
  it('פרויקט שהסתיים: אין דיווח חדש, אין עריכה וביטול, ההדפסה נשארת', () => {
    const out = html(screen({ canReport: false, readOnlyNote: 'הפרויקט הסתיים או בארכיון. אפשר לצפות ולהדפיס בלבד.' }));
    expect(out).not.toContain('דיווח חדש');
    expect(out).not.toContain('עריכה');
    expect(out).not.toContain('ביטול דיווח');
    expect(out).toContain('אפשר לצפות ולהדפיס בלבד');
    expect(out).toContain('הדפסה / PDF');
  });
  it('עריכה לפי הרשאת השרת בלבד, וביטול רק למי שהשרת מתיר', () => {
    expect(html(screen({ rows: [row({ canCorrect: true })] }))).toContain('/edit');
    expect(html(screen({ rows: [row({ canCorrect: true })] }))).not.toContain('ביטול דיווח');
    expect(html(screen({ rows: [row({ canCorrect: true, canMoveOrCancel: true })] }))).toContain('ביטול דיווח');
  });
  it('בטאב של פרויקט: בלי בחירת פרויקט, וכפתור דיווח מוביל לפרויקט', () => {
    const out = html(screen({ projects: null, fixedProjectId: P, basePath: `/projects/${P}/diary` }));
    expect(out).toContain(`/diary/new?project=${P}`);
    expect(out).not.toContain('כל הפרויקטים');
  });
  it('כל תצוגה נבנית פעם אחת ומוסתרת ב-CSS', () => {
    const out = html(screen());
    expect(out.match(/m-only/g)?.length).toBe(1);
    expect(out.match(/d-only/g)?.length).toBe(1);
  });
});
