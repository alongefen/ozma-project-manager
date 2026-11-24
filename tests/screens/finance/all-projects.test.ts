import { describe, expect, it, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }) }));
vi.mock('@/features/finance/logic/actions', () => ({ createTransaction: vi.fn(), updateTransaction: vi.fn(), cancelTransaction: vi.fn(), setExcelLink: vi.fn() }));
import type { Platform, RequestContext } from '@/types/contracts';
import { getAllFinance } from '@/features/overview/logic/finance-all';
import { loadFinanceAll } from '@/features/overview/shared/load';
import { FinanceNavProvider } from '@/features/finance/shared/nav';
import { FinanceMobile } from '@/features/finance/mobile/FinanceMobile';
import { FinanceDesktop } from '@/features/finance/desktop/FinanceDesktop';
import { PrintView } from '@/features/finance/shared/PrintView';
import { allExportHref } from '@/features/finance/shared/query';
import { format } from '@/lib/format';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const T1 = 'a0000000-0000-4000-8000-000000000001', T2 = 'a0000000-0000-4000-8000-000000000002', T3 = 'a0000000-0000-4000-8000-000000000003', T4 = 'a0000000-0000-4000-8000-000000000004';
const raw = (id: string, project_id: string, kind: string, amount: number, details: string, day = 5) =>
  ({ id, project_id, year: 2026, month: 11, day, kind, amount, details, position: 1, cancelled_at: null, revision: 1 });
const rows = [raw(T1, A, 'income', 100000, 'תשלום לקוח'), raw(T2, A, 'expense', 20000, 'ברזל'), raw(T3, B, 'income', 50000, 'מקדמה'), raw(T4, B, 'expense', 10000, 'ברזל ושרשראות', 9)];
const totals = [
  { projectId: A, projectName: 'בניין א', year: 2026, month: 11, income: 100000, expense: 20000 },
  { projectId: B, projectName: 'בניין ב', year: 2026, month: 11, income: 50000, expense: 10000 },
];
const projects = [{ id: A, name: 'בניין א' }, { id: B, name: 'בניין ב' }];

function fake(owner: boolean) {
  const touched: string[] = [];
  const db = { from: () => ({ select: () => ({ order: () => ({ order: async () => { touched.push('projects'); return { data: projects, error: null }; } }) }) }) };
  const platform = {
    format,
    permissions: { requireOwner: async () => owner ? { ok: true, value: {} } : { ok: false, error: { code: 'FORBIDDEN', message: 'x' } } },
    rpc: async (_c: unknown, name: string) => { touched.push(name); return { ok: true, value: name === 'diary_summary' ? { workDays: 3 } : totals }; },
    fetchAll: async () => { touched.push('fetchAll'); return rows; },
  } as unknown as Platform;
  const ctx = { actor: { userId: 'u', fullName: 'בדוי', email: 'a@example.test', isOwner: owner }, db, today: '2026-11-24' } as unknown as RequestContext;
  return { platform, ctx, touched };
}

describe('כספי כל הפרויקטים: נתונים', () => {
  it('סוכם על פני פרויקטים; המס הוא סכום המסים של כל פרויקט', async () => {
    const { platform, ctx } = fake(true);
    const r = await getAllFinance(platform, ctx, { filter: { period: 'all' } });
    if (!r.ok) throw new Error('expected ok ' + JSON.stringify(r.error));
    const { book, projectOf } = r.value;
    expect(book.period.income).toBe(150000);
    expect(book.period.expense).toBe(30000);
    expect(book.canWrite).toBe(false);
    expect(book.workDays).toBe(3);
    expect(book.months).toHaveLength(1);
    expect(projectOf).toMatchObject({ [T1]: 'בניין א', [T3]: 'בניין ב' });
    expect(book.filteredRows).toEqual({ income: 150000, expense: 30000 });
  });
  it('סינון לפי חיפוש ויום משנה את סיכום השורות המוצגות בלבד', async () => {
    const { platform, ctx } = fake(true);
    const r = await getAllFinance(platform, ctx, { filter: { period: 'all', search: 'ברזל' } });
    if (!r.ok) throw new Error('expected ok ' + JSON.stringify(r.error));
    expect(r.value.filteredRows).toEqual({ income: 0, expense: 30000 });
    const d = await getAllFinance(platform, ctx, { filter: { period: { year: 2026, month: 11 }, day: 9 } });
    if (!d.ok) throw new Error('expected ok');
    expect(d.value.filteredRows).toEqual({ income: 0, expense: 10000 });
  });
  it('פרויקט נבחר מצמצם גם את הסיכום וגם את השורות', async () => {
    const { platform, ctx } = fake(true);
    const r = await getAllFinance(platform, ctx, { filter: { period: 'all' }, projectId: B });
    if (!r.ok) throw new Error('expected ok ' + JSON.stringify(r.error));
    expect(r.value.book.period.income).toBe(50000);
    expect(r.value.book.projectName).toBe('בניין ב');
  });
  it('פרויקט לא מוכר נדחה', async () => {
    const { platform, ctx } = fake(true);
    const r = await getAllFinance(platform, ctx, { filter: { period: 'all' }, projectId: '33333333-3333-4333-8333-333333333333' });
    expect(r.ok).toBe(false);
  });
  it('לא בעלים: נדחה בשרת ולא נקרא שום נתון', async () => {
    const { platform, ctx, touched } = fake(false);
    const r = await getAllFinance(platform, ctx, { filter: { period: 'all' } });
    expect(r.ok).toBe(false);
    expect(touched).toEqual([]);
  });
  it('המסך: לא בעלים מקבל hidden בלי שאילתה', async () => {
    const { platform, ctx, touched } = fake(false);
    expect(await loadFinanceAll(platform, ctx, { period: 'all' })).toEqual({ kind: 'hidden' });
    expect(touched).toEqual([]);
  });
});

describe('כספי כל הפרויקטים: מסך', () => {
  it('אותו מסך כמו בפרויקט, עם עמודת פרויקט, סינון פרויקט וייצוא נפרד מהדפסה', async () => {
    const { platform, ctx } = fake(true);
    const r = await getAllFinance(platform, ctx, { filter: { period: 'all' } });
    if (!r.ok) throw new Error('expected ok ' + JSON.stringify(r.error));
    const { book, filteredRows, projectOf } = r.value;
    const html = renderToStaticMarkup(h(FinanceNavProvider, { all: { projects, projectOf, project: null }, filter: { period: 'all' }, children: [
      h(FinanceMobile, { key: 'm', book, filteredRows, today: ctx.today }), h(FinanceDesktop, { key: 'd', book, filteredRows, today: ctx.today }), h(PrintView, { key: 'p', book, filteredRows })] }));
    expect(html).toContain('כל הפרויקטים');
    expect(html).toContain('>פרויקט<');
    expect(html).toContain('בניין ב');
    expect(html).toContain('href="/finance/export?period=all"');
    expect(html).toContain('הדפסה');
    expect(html).not.toContain('הוספת תנועה');
    expect(html).not.toContain('קישור לקובץ Excel');
    expect(allExportHref({ period: 'all', search: 'x' }, B)).toBe(`/finance/export?period=all&search=x&project=${B}`);
  });
});
