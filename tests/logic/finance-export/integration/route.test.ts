import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db, ErrorCode, FinanceFilter, RequestContext, TransactionRow } from '@/types/contracts';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ createPlatform: vi.fn() }));
vi.mock('@/lib/auth/platform', () => ({ createPlatform: mocks.createPlatform }));
vi.mock('@/features/finance-export/logic', async original => {
  const logic = await original<typeof import('@/features/finance-export/logic')>();
  return { createFinanceExportApi: vi.fn(logic.createFinanceExportApi) };
});
vi.mock('@/features/finance-export/logic/rendering', async original => {
  const engine = await original<typeof import('@/features/finance-export/logic/rendering')>();
  return { renderFinanceWorkbook: vi.fn(engine.renderFinanceWorkbook) };
});
import * as route from '@/app/api/exports/finance/route';
import { createFinanceExportApi } from '@/features/finance-export/logic';
import { renderFinanceWorkbook } from '@/features/finance-export/logic/rendering';
import { failure } from '@/lib/db/rpc';
import { format } from '@/lib/format';
import { contentType, expectDenied, expectDownload, pairsAfter, statuses } from './support';

const projectId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const valid = `projectId=${projectId}&period=all`;
const internal = 'פנימי: relation transactions, פרויקט סודי 987654';
const exportApi = vi.mocked(createFinanceExportApi);
const render = vi.mocked(renderFinanceWorkbook);
const row = (position: number, day: number, kind: TransactionRow['kind'], amount: number, details: string): TransactionRow =>
  ({ id: `00000000-0000-4000-8000-00000000000${position}`, year: 2026, month: 12, day, position, kind, amount, details, cancelledAt: null, revision: 1 });

// פלטפורמה בדויה מתחת ל-getBook ולמנוע האמיתיים; רק הזהות והנתונים מוזרקים.
function server({ viewFinance = true, projectError = null as unknown } = {}) {
  const from = vi.fn((table: string) => {
    const result = table !== 'projects' ? { data: { excel_url: null, revision: 1 }, error: null }
      : { data: projectError ? null : { id: projectId, name: 'פרויקט סודי' }, error: projectError };
    const query = { select: () => query, eq: () => query, single: async () => result };
    return query;
  });
  const ctx: RequestContext = {
    actor: { userId: otherId, fullName: 'בדוי', email: 'test@example.invalid', isOwner: false },
    db: { from } as unknown as Db, today: '2026-11-22',
  };
  const getContext = vi.fn().mockResolvedValue({ ok: true, value: ctx });
  const forProject = vi.fn().mockResolvedValue({ ok: true, value: { viewFinance, writeFinance: false, cancelTransaction: false } });
  const rpc = vi.fn(async (_ctx: RequestContext, name: string) => ({ ok: true, value: name === 'diary_summary' ? { workDays: 3 }
    : [{ year: 2026, month: 12, income: 300050, expense: 4000 }] }));
  const fetchAll = vi.fn(async () => [row(1, 2, 'income', 100050, '=1+1 ייצוא'), row(2, 3, 'income', 200000, 'מחוץ לסינון'), row(3, 2, 'expense', 4000, 'הוצאה בדויה')]);
  mocks.createPlatform.mockResolvedValue({ auth: { getContext }, permissions: { forProject }, rpc, fetchAll, format });
  return { ctx, getContext, forProject, rpc, from };
}
const get = (query = valid, headers: Record<string, string> = {}) =>
  route.GET(new Request(`https://app.invalid/api/exports/finance?${query}`, { headers }));

beforeEach(() => vi.clearAllMocks());

describe('נתיב הורדת הכספים', () => {
  it('רץ ב-Node וחושף קריאה בלבד', () => {
    expect(route.runtime).toBe('nodejs');
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) expect(route).not.toHaveProperty(method);
  });
  it('מורשה מקבל שורות מסוננות עם סיכומי חודש ותקופה מלאים', async () => {
    server();
    const rows = await expectDownload(await get(`projectId=${projectId}&period=2026-12&day=2&search=${encodeURIComponent('ייצוא')}`), 'כספים-2026-12.xlsx');
    expect(pairsAfter(rows, 'סיכום תקופה', 2)).toEqual([['הכנסות', 3000.5], ['הוצאות', 40]]);
    expect(pairsAfter(rows, 'סיכום חודש', 2)).toEqual([['הכנסות', 3000.5], ['הוצאות', 40]]);
    expect(pairsAfter(rows, 'סיכום שורות מסוננות', 2)).toEqual([['הכנסות', 1000.5], ['הוצאות', 0]]);
    expect(rows).toContainEqual([2, 'הכנסה', '=1+1 ייצוא', 1000.5]);
    expect(rows.flat()).not.toContain('מחוץ לסינון');
    expect(rows.flat()).not.toContain('הוצאה בדויה');
  });
  it.each<[string, FinanceFilter, string]>([
    ['period=all', { period: 'all' }, 'כל-התקופה'],
    ['period=2000-01', { period: { year: 2000, month: 1 } }, '2000-01'],
    ['period=2100-12', { period: { year: 2100, month: 12 } }, '2100-12'],
    ['period=all&day=1', { period: 'all', day: 1 }, 'כל-התקופה'],
    ['period=all&day=09', { period: 'all', day: 9 }, 'כל-התקופה'],
    ['period=2026-02&day=31', { period: { year: 2026, month: 2 }, day: 31 }, '2026-02'],
    ['period=all&search=', { period: 'all', search: '' }, 'כל-התקופה'],
    [`period=all&search=${encodeURIComponent(' א+ב & "=1" ')}`, { period: 'all', search: ' א+ב & "=1" ' }, 'כל-התקופה'],
  ])('%s מתורגם במדויק', async (query, filter, name) => {
    const { forProject, ctx } = server();
    await expectDownload(await get(`projectId=${projectId}&${query}`), `כספים-${name}.xlsx`);
    expect(forProject).toHaveBeenCalledExactlyOnceWith(ctx, { projectId });
    expect(render.mock.calls[0][0].filter).toStrictEqual(filter);
  });
  it('התגובה מוזרמת לפני שהזרם הסתיים', async () => {
    server();
    let finish!: () => void;
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(new Uint8Array([80, 75]));
      finish = () => controller.close();
    } });
    exportApi.mockReturnValueOnce({ renderWorkbook: async () => ({ ok: true, value: { fileName: 'כספים-כל-התקופה.xlsx', contentType, stream } }) });
    const reader = (await get()).body!.getReader();
    expect(Array.from((await reader.read()).value!)).toEqual([80, 75]);
    finish();
    expect((await reader.read()).done).toBe(true);
  }, 2000);
});

describe('זהות נגזרת בשרת בכל בקשה', () => {
  it.each(['UNAUTHENTICATED', 'RATE_LIMITED', 'UNAVAILABLE'] as const)('כשל זהות %s קודם לבדיקת הפרמטרים', async code => {
    const { getContext, forProject } = server();
    getContext.mockResolvedValue(failure(code));
    for (const query of ['', valid, 'period=bad&userId=forged']) await expectDenied(await get(query), code);
    expect(exportApi).not.toHaveBeenCalled();
    expect(forProject).not.toHaveBeenCalled();
  });
  it('כותרות מזויפות אינן קלט לזהות', async () => {
    const { ctx, getContext, forProject } = server({ viewFinance: false });
    await expectDenied(await get(valid, { authorization: 'Bearer forged', cookie: 'actor=owner', 'x-user-id': projectId }), 'NOT_FOUND');
    expect(getContext).toHaveBeenCalledExactlyOnceWith();
    expect(forProject.mock.calls[0][0]).toBe(ctx);
  });
  it('סשן ושלילת כספים נבדקים מחדש בבקשה הבאה', async () => {
    const { getContext, forProject } = server();
    expect((await get()).status).toBe(200);
    forProject.mockResolvedValueOnce({ ok: true, value: { viewFinance: false } });
    await expectDenied(await get(), 'NOT_FOUND');
    getContext.mockResolvedValueOnce(failure('UNAUTHENTICATED'));
    await expectDenied(await get(), 'UNAUTHENTICATED');
    expect(mocks.createPlatform).toHaveBeenCalledTimes(3);
  });
});

describe('פרמטרים שנדחים בלי ברירת מחדל', () => {
  const project = `projectId=${projectId}`;
  const periods = ['', 'ALL', '%20all', 'all%20', '2026', '2026-1', '2026-00', '2026-13', '1999-12', '2101-01', '2026%2F12', '2026-12-01', '2026-12%0A', '%2B2026-12', '%D9%A2%D9%A0%D9%A2%D9%A6-12'];
  const days = ['', '0', '00', '32', '001', '1.5', '-1', '%2B1', '%201', '1%0A', '1e1', '0x1', '%D9%A2'];
  const unknown = ['userId', 'actorId', 'role', 'isOwner', 'filter', 'Period', 'day[]', '__proto__', 'constructor', 'toString', ''];
  it.each([
    '', project, 'period=all', 'projectId=&period=all', 'projectId=invalid&period=all', `projectId=%20${projectId}&period=all`,
    ...periods.map(value => `${project}&period=${value}`),
    ...days.map(value => `${valid}&day=${value}`),
    ...unknown.map(key => `${valid}&${key}=1`),
    `${valid}&${project}`, `${valid}&projectId=${otherId}`, `${valid}&period=all`,
    `${valid}&day=2&day=2`, `${valid}&search=&search=`,
  ])('?%s → 400', async query => {
    const { forProject, rpc, from } = server();
    await expectDenied(await get(query), 'VALIDATION');
    for (const access of [forProject, rpc, from, render]) expect(access).not.toHaveBeenCalled();
  });
});

describe('דחייה וכשל בלי קובץ או פרטים פנימיים', () => {
  it('עובד או מנהל ללא כספים נחסם לפני קריאת נתונים', async () => {
    const { rpc, from } = server({ viewFinance: false });
    await expectDenied(await get(), 'NOT_FOUND');
    for (const access of [rpc, from, render]) expect(access).not.toHaveBeenCalled();
  });
  it('פרויקט שאינו קיים נראה כמו פרויקט אסור', async () => {
    server({ viewFinance: false });
    const forbidden = await get();
    server({ projectError: { code: 'PGRST116', message: internal } });
    const missing = await get();
    expect([...missing.headers]).toEqual([...forbidden.headers]);
    await expectDenied(forbidden, 'NOT_FOUND');
    await expectDenied(missing, 'NOT_FOUND');
  });
  it.each(Object.keys(statuses) as ErrorCode[])('כשל %s ממופה לסטטוס', async code => {
    server().forProject.mockResolvedValue(failure(code));
    await expectDenied(await get(), code);
  });
  it.each<[string, () => void]>([
    ['יצירת הפלטפורמה', () => { server(); mocks.createPlatform.mockRejectedValue(new Error(internal)); }],
    ['זהות', () => { server().getContext.mockRejectedValue(new Error(internal)); }],
    ['מסד', () => { server({ projectError: { code: 'XX000', message: internal } }); }],
    ['מנוע', () => { server(); render.mockRejectedValueOnce(new Error(internal)); }],
    ['לוגיקת הייצוא', () => { server(); exportApi.mockReturnValueOnce({ renderWorkbook: async () => { throw new Error(internal); } }); }],
  ])('תקלה לא צפויה ב%s היא 503 בלבד', async (_label, arrange) => {
    arrange();
    await expectDenied(await get(), 'UNAVAILABLE');
  });
});
