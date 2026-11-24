import { describe, expect, it, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { HomeData, Platform, RequestContext, TransferMonth } from '@/types/contracts';

vi.mock('server-only', () => ({}));
import { HomeMobile } from '@/features/overview/mobile/HomeMobile';
import { HomeDesktop } from '@/features/overview/desktop/HomeDesktop';
import { TransferMobile } from '@/features/overview/mobile/TransferMobile';
import { TransferDesktop } from '@/features/overview/desktop/TransferDesktop';
import { loadTransfer } from '@/features/overview/shared/load';
import { filterProjects } from '@/features/overview/shared/filter';
import { projectBadges, taskBubble, transferViews } from '@/features/overview/shared/view-model';

const card = { id: 'p1', name: 'בניין בדוי', businessName: 'חברה בדויה', siteAddress: 'רחוב 1', status: 'active' as const, archived: false, coverFileId: null, reportCount: 3, openTaskCount: 2 };
const cube = { month: { year: 2026, month: 11 }, income: 1_000_000, expense: 400_000, tax: 100_000, totalExpense: 500_000, netProfit: 500_000, profitPercentTenths: 500 };
const home = (financeCube: HomeData['financeCube']): HomeData => ({ counters: { activeProjects: 1, reportsToday: 3, customers: 1, openTasks: 2 }, projects: [card], financeCube });
const summary = (month: number, tax: number) => ({ year: 2026, month, income: 100, expense: 50, tax, totalExpense: 50 + tax, netProfit: 50 - tax, profitPercentTenths: 0, balance: 0 });
const months: TransferMonth[] = [
  { month: { year: 2026, month: 10 }, transferAmount: 1000, projects: [{ projectId: 'p1', projectName: 'בניין בדוי', summary: summary(10, 1000) }] },
  { month: { year: 2026, month: 11 }, transferAmount: 2000, projects: [{ projectId: 'p1', projectName: 'בניין בדוי', summary: summary(11, 2000) }] },
];
const both = (d: HomeData, isOwner = true) => renderToStaticMarkup(h('div', null, h(HomeMobile, { data: d, isOwner }), h(HomeDesktop, { data: d, isOwner })));

describe('מסך הבית', () => {
  it('בעלים: קובייה וקישור לסכום העברה', () => {
    const html = both(home(cube));
    expect(html).toContain('לפירוט התנועות');
    expect(html).toContain('href="/finance"');
    expect(html).toContain('הכנסות');
  });
  it('בלי קובייה מהשרת: אין שום נתון כספי ואין קישור לכספים', () => {
    const html = both(home(null));
    expect(html).not.toContain('הכנסות');
    expect(html).not.toContain('/finance');
    expect(html).not.toContain('₪');
    expect(html).toContain('בניין בדוי');
  });
  it('תגים: סטטוס, משימות ודיווחים; נעלמים כשאין', () => {
    expect(projectBadges(card).map(b => b.text)).toEqual(['פעיל', '3 דיווחים']);
    expect(projectBadges({ ...card, status: 'completed', openTaskCount: 0, reportCount: 0 }).map(b => b.text)).toEqual(['הסתיים']);
  });
  it('כפתור פרויקט חדש רק לבעלים, וחיפוש וסינון מופיעים', () => {
    expect(both(home(cube), true)).toContain('href="/projects/new"');
    expect(both(home(null), false)).not.toContain('/projects/new');
    expect(both(home(null), false)).toContain('חיפוש פרויקט');
    expect(both(home(null), false)).toContain('הסתיימו');
  });
  it('סינון: לפי שם, לקוח, כתובת וסטטוס', () => {
    const done = { ...card, id: 'p2', name: 'חניון', businessName: 'לוג-פארק', siteAddress: 'הנמל 5', status: 'completed' as const };
    const all = [card, done];
    expect(filterProjects(all, '', 'all')).toHaveLength(2);
    expect(filterProjects(all, 'בדוי', 'all').map(c => c.id)).toEqual(['p1']);
    expect(filterProjects(all, 'לוג', 'all').map(c => c.id)).toEqual(['p2']);
    expect(filterProjects(all, 'הנמל', 'all').map(c => c.id)).toEqual(['p2']);
    expect(filterProjects(all, '', 'completed').map(c => c.id)).toEqual(['p2']);
    expect(filterProjects(all, 'בדוי', 'completed')).toEqual([]);
  });
  it('בועת משימות פתוחות על הכרטיס: מספר, 99+, ושום דבר כשאין', () => {
    expect(taskBubble(0)).toBeNull();
    expect(taskBubble(2)).toEqual({ text: '2', label: '2 משימות פתוחות' });
    expect(taskBubble(150)?.text).toBe('99+');
    expect(both(home(null))).toContain('aria-label="2 משימות פתוחות"');
    expect(both({ ...home(null), projects: [{ ...card, openTaskCount: 0 }] })).not.toContain('משימות פתוחות"');
  });
  it('רשימה ריקה: הודעה', () => {
    expect(both({ ...home(null), projects: [] })).toContain('אין פרויקטים להצגה');
  });
});

describe('סכום העברה', () => {
  it('חודשים מהחדש לישן, סכום העברה מהשרת, ופירוט לפי פרויקט', () => {
    const views = transferViews(months);
    expect(views.map(v => v.key)).toEqual(['2026-11', '2026-10']);
    const html = renderToStaticMarkup(h('div', null, h(TransferMobile, { months }), h(TransferDesktop, { months })));
    expect(html).toContain('נובמבר 2026');
    expect(html).toContain('בניין בדוי');
    expect(html).toContain('סכום העברה');
  });
  it('אין חודשים: הודעה', () => {
    expect(renderToStaticMarkup(h(TransferMobile, { months: [] }))).toContain('עדיין אין חודשים');
  });
});

describe('כספים לכל הפרויקטים: הרשאות בשרת', () => {
  const ctx = (isOwner: boolean) => ({ actor: { userId: 'u', fullName: 'בדוי', email: 'a@example.test', isOwner }, db: {}, today: '2026-11-23' }) as unknown as RequestContext;
  const touched: string[] = [];
  const platform = { permissions: { requireOwner: async () => { touched.push('owner'); return { ok: false, error: { code: 'FORBIDDEN', message: 'x' } }; } }, rpc: async (_c: unknown, n: string) => { touched.push(n); return { ok: true, value: [] }; } } as unknown as Platform;
  it('מנהל או עובד: hidden, ושום קריאת נתונים', async () => {
    expect(await loadTransfer(platform, ctx(false))).toEqual({ kind: 'hidden' });
    expect(touched).toEqual([]);
  });
  it('בעלים שהשרת מסרב לו: hidden ולא נתונים', async () => {
    expect(await loadTransfer(platform, ctx(true))).toEqual({ kind: 'hidden' });
  });
});
