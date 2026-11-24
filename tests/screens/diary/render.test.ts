import { describe, expect, it, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DiaryRow } from '@/types/contracts';
import type { DiaryScreen } from '@/features/diary/shared/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }));
vi.mock('@/features/diary/logic/actions', () => ({ listEntries: vi.fn(), cancelEntry: vi.fn(), createEntry: vi.fn(), correctEntry: vi.fn(), moveEntry: vi.fn() }));
vi.mock('@/features/reports/logic/actions', () => ({ planReport: vi.fn() }));

import { DiaryMobile } from '@/features/diary/mobile/DiaryMobile';
import { DiaryProvider } from '@/features/diary/shared/DiaryProvider';
import { DiaryDesktop } from '@/features/diary/desktop/DiaryDesktop';

const P = '11111111-1111-4111-8111-111111111111';
const row = (over: Partial<DiaryRow> = {}): DiaryRow => ({
  id: '22222222-2222-4222-8222-222222222222', projectId: P, projectName: 'בית ספר', workDate: '2026-11-23', body: 'יצקנו תקרה', reporterId: P, reporterName: 'דנה כהן',
  enteredAt: '2026-11-23T08:00:00.000Z', editedAt: null, editedByName: null, cancelledAt: null, files: [], revision: 1, canCorrect: false, canMoveOrCancel: false, ...over,
});
const screen = (over: Partial<DiaryScreen> = {}): DiaryScreen => ({
  rows: [row()], nextCursor: null, filter: {}, projects: [{ id: P, name: 'בית ספר' }], canReport: true, formProjects: [{ id: P, name: 'בית ספר' }], isOwner: false, today: '2026-11-23', basePath: '/diary', ...over,
});
const html = (s: DiaryScreen) => renderToStaticMarkup(h(DiaryProvider, { screen: s, children: [h(DiaryMobile, { key: 'm', screen: s }), h(DiaryDesktop, { key: 'd', screen: s })] }));

import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';

describe('טופס הדיווח הוא חלון, לא עמוד', () => {
  it('אין עמוד עריכה; הטופס נפתח ב-Sheet המשותף', () => {
    expect(existsSync('src/app/(app)/diary/[id]')).toBe(false);
    expect(readFileSync('src/features/diary/shared/DiaryProvider.tsx', 'utf8')).toMatch(/<Sheet\b/);
  });
});

describe('תג הסינון', () => {
  const badge = (s: DiaryScreen) => html(s).match(/class="ui-count"[^>]*>(\d+)</)?.[1] ?? null;
  it('אין תג כשאין סינון, גם בטאב של פרויקט (הפרויקט עצמו אינו סינון)', () => {
    expect(badge(screen())).toBeNull();
    expect(badge(screen({ fixedProjectId: P, projects: null, filter: { projectId: P } }))).toBeNull();
  });
  it('בטאב של פרויקט, טווח תאריכים נספר כסינון אחד', () => {
    expect(badge(screen({ fixedProjectId: P, projects: null, filter: { projectId: P, from: '2026-11-01' } }))).toBe('1');
  });
  it('ביומן הכללי נספרים הפרויקט וטווח התאריכים', () => {
    expect(badge(screen({ filter: { projectId: P, from: '2026-11-01', to: '2026-11-20' } }))).toBe('2');
  });
});

describe('טלפון ותצוגה מקדימה', () => {
  it('בטלפון אין כפתור דיווח חדש בראש היומן (יש בשורה התחתונה); בדסקטופ יש', () => {
    const mobile = renderToStaticMarkup(h(DiaryProvider, { screen: screen(), children: h(DiaryMobile, { screen: screen() }) }));
    expect(mobile).not.toContain('דיווח חדש');
    const desktop = renderToStaticMarkup(h(DiaryProvider, { screen: screen(), children: h(DiaryDesktop, { screen: screen(), title: 'יומן' }) }));
    expect(desktop).toContain('דיווח חדש');
  });
  it('תמונה מוצגת בתצוגה מקדימה קטנה; PDF כשם קובץ; בלי מזהה פרויקט', () => {
    const files = [
      { id: '33333333-3333-4333-8333-333333333333', name: 'crack.png', mime: 'image/png', sizeBytes: 5, displayState: 'ready' as const },
      { id: '44444444-4444-4444-8444-444444444444', name: 'plan.pdf', mime: 'application/pdf', sizeBytes: 5, displayState: 'none' as const },
    ];
    const out = html(screen({ rows: [row({ files })] }));
    expect(out).toContain('/api/storage/files/33333333-3333-4333-8333-333333333333?variant=display');
    expect(out).toContain('plan.pdf');
    expect(out).not.toContain(P);
  });
});

describe('מסכי היומן', () => {
  it('מי שרשאי לדווח רואה כפתור דיווח חדש; הדפסה לכל אחד', () => {
    const out = html(screen());
    expect(out).toContain('דיווח חדש');
    expect(out).toContain('/api/reports/diary?kind=entry');
    expect(out).toContain('הדפסה וייצוא לפי תאריך');
    expect(out).toContain('dr-toolbar');
    // print (inline) and export (download) are two separate actions, never one combined control
    expect(out).toContain('aria-label="הדפסת הדיווח"');
    expect(out).toContain('aria-label="ייצוא הדיווח ל-PDF"');
    expect(out).toContain('download=1');
    expect(out).not.toContain('הדפסה / PDF');
  });
  it('פרויקט שהסתיים: אין דיווח חדש, אין עריכה וביטול, ההדפסה נשארת', () => {
    const out = html(screen({ canReport: false, readOnlyNote: 'הפרויקט הסתיים או בארכיון. אפשר לצפות ולהדפיס בלבד.' }));
    expect(out).not.toContain('דיווח חדש');
    expect(out).not.toContain('עריכת הדיווח');
    expect(out).not.toContain('ביטול הדיווח');
    expect(out).toContain('אפשר לצפות ולהדפיס בלבד');
    expect(out).toContain('הדפסת הדיווח');
    expect(out).toContain('ui-iconbtn');
  });
  it('עריכה לפי הרשאת השרת בלבד, וביטול רק למי שהשרת מתיר', () => {
    expect(html(screen({ rows: [row({ canCorrect: true })] }))).toContain('עריכת הדיווח');
    expect(html(screen({ rows: [row({ canCorrect: true })] }))).not.toContain('ביטול הדיווח');
    expect(html(screen({ rows: [row({ canCorrect: true, canMoveOrCancel: true })] }))).toContain('ui-iconbtn ui-iconbtn--danger');
  });
  it('בטאב של פרויקט: בלי בחירת פרויקט, וכפתור הדיווח פותח חלון (לא עמוד)', () => {
    const out = html(screen({ projects: null, fixedProjectId: P, basePath: `/projects/${P}/diary` }));
    expect(out).not.toContain('/diary/new');
    expect(out).not.toContain('כל הפרויקטים');
  });
  it('כל תצוגה נבנית פעם אחת ומוסתרת ב-CSS', () => {
    const out = html(screen());
    expect(out.match(/m-only/g)?.length).toBe(1);
    expect(out.match(/d-only/g)?.length).toBe(1);
  });
  it('הכותרת בדסקטופ זהה לשאר המסכים: רק ביומן הכללי, באותה שורת כותרת (ui-ph), ובלי כותרת בטאב של פרויקט', () => {
    const general = renderToStaticMarkup(h(DiaryProvider, { screen: screen(), children: h(DiaryDesktop, { screen: screen(), title: 'יומן עבודה' }) }));
    expect(general).toContain('<h1 class="ui-ph__title">יומן עבודה</h1>');
    expect(general).not.toContain('dr-bar');
    const tab = renderToStaticMarkup(h(DiaryProvider, { screen: screen(), children: h(DiaryDesktop, { screen: screen() }) }));
    expect(tab).not.toContain('ui-ph__title');
  });
});
