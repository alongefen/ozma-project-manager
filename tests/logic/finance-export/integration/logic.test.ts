import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db, ErrorCode, FinanceFilter, Platform, RequestContext } from '@/types/contracts';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ create: vi.fn(), getBook: vi.fn(), privileged: vi.fn() }));
vi.mock('@/features/finance/logic', () => ({ createFinanceApi: mocks.create }));
vi.mock('@/lib/db/clients', () => ({ createPrivilegedClient: mocks.privileged }));
vi.mock('@/features/finance-export/logic/rendering', async original => {
  const engine = await original<typeof import('@/features/finance-export/logic/rendering')>();
  return { renderFinanceWorkbook: vi.fn(engine.renderFinanceWorkbook) };
});
import { createFinanceExportApi } from '@/features/finance-export/logic';
import { renderFinanceWorkbook } from '@/features/finance-export/logic/rendering';
import { failure } from '@/lib/db/rpc';
import { financeBookFixture } from '../rendering/fixtures';
import { contentType, pairsAfter, sheetRows, statuses } from './support';

const projectId = '11111111-1111-4111-8111-111111111111';
const month = { year: 2026, month: 12 };
const render = vi.mocked(renderFinanceWorkbook);

function fixture() {
  const book = financeBookFixture();
  mocks.create.mockReturnValue({ getBook: mocks.getBook });
  mocks.getBook.mockResolvedValue({ ok: true, value: book });
  const data = { from: vi.fn(), rpc: vi.fn(), platformRpc: vi.fn(), fetchAll: vi.fn() };
  const ctx: RequestContext = {
    actor: { userId: projectId, fullName: 'בדוי', email: 'test@example.invalid', isOwner: false },
    db: { from: data.from, rpc: data.rpc } as unknown as Db, today: '2026-11-22',
  };
  const platform = { rpc: data.platformRpc, fetchAll: data.fetchAll } as unknown as Platform;
  return { api: createFinanceExportApi(platform), book, ctx, platform, data };
}
async function rendered(filter: FinanceFilter) {
  const f = fixture();
  const result = await f.api.renderWorkbook(f.ctx, { projectId, filter });
  if (!result.ok) throw new Error(`הייצוא נכשל: ${result.error.code}`);
  return { ...f, artifact: result.value };
}

beforeEach(() => vi.clearAllMocks());

describe('חיבור הספר למנוע Excel', () => {
  it('אותו ספר מגיע למנוע, בלי שליפה נוספת או לקוח מיוחס', async () => {
    const fetched = vi.spyOn(globalThis, 'fetch');
    const filter = { period: month, day: 15, search: 'עבודה' };
    const { book, ctx, platform, data } = await rendered(filter);
    expect(mocks.create.mock.calls[0][0]).toBe(platform);
    expect(mocks.getBook).toHaveBeenCalledExactlyOnceWith(ctx, { projectId, filter });
    expect(mocks.getBook.mock.calls[0][0]).toBe(ctx);
    expect(render).toHaveBeenCalledOnce();
    expect(render.mock.calls[0][0]).toBe(book);
    expect(book).toEqual(financeBookFixture());
    for (const access of [...Object.values(data), mocks.privileged, fetched]) expect(access).not.toHaveBeenCalled();
    fetched.mockRestore();
  });
  it('הקובץ בזרם נושא את השורות והסיכומים שנמסרו, גם כשאינם סכום השורות', async () => {
    const { artifact, book } = await rendered({ period: 'all', day: 15, search: 'עבודה' });
    expect(artifact.contentType).toBe(contentType);
    expect(artifact.stream).toBeInstanceOf(ReadableStream);
    const rows = await sheetRows(await new Response(artifact.stream).arrayBuffer());
    const totals = [['הכנסות (לא כולל מע״מ)', 9876.54], ['הוצאות', 3456.78], ['מס', 123.45], ['סה״כ הוצאות', 3580.23],
      ['רווח נקי', 6296.31], ['אחוז רווח', 0.637], ['שארית', 8123.45]];
    expect(pairsAfter(rows, 'סיכום תקופה', 7)).toEqual(totals);
    expect(pairsAfter(rows, 'סיכום חודש', 7)).toEqual(totals);
    expect(pairsAfter(rows, 'סיכום שורות מסוננות', 2)).toEqual([['הכנסות (לא כולל מע״מ)', 98.45], ['הוצאות', 49.88]]);
    const delivered = [...book.months[0].incomeRows, ...book.months[0].expenseRows].map(row => [row.details, row.amount / 100]);
    const details = new Set(delivered.map(row => row[0]));
    expect(rows.filter(row => details.has(row[2] as string)).map(row => [row[2], row[3]])).toEqual(delivered);
  });
  it.each<[FinanceFilter, string]>([
    [{ period: 'all', search: '../"סוד"\r\n' }, 'כספים-כל-התקופה.xlsx'],
    [{ period: { year: 2000, month: 1 }, day: 1 }, 'כספים-2000-01.xlsx'],
    [{ period: { year: 2100, month: 12 }, day: 31, search: '' }, 'כספים-2100-12.xlsx'],
  ])('מסנן תקין %j נותן שם קובץ קבוע %s', async (filter, fileName) => {
    const { artifact, ctx } = await rendered(filter);
    expect(artifact.fileName).toBe(fileName);
    expect(mocks.getBook).toHaveBeenCalledWith(ctx, { projectId, filter });
  });
});

describe('מה נדחה בייצוא', () => {
  const all = { period: 'all' };
  it.each<[string, unknown]>([
    ['בלי קלט', null],
    ['בלי פרויקט', { filter: all }],
    ['מזהה פרויקט שגוי', { projectId: 'invalid', filter: all }],
    ['בלי מסנן', { projectId }],
    ['בלי תקופה', { projectId, filter: {} }],
    ['תקופה כמחרוזת', { projectId, filter: { period: '2026-12' } }],
    ['זהות מהקורא', { projectId, filter: all, userId: projectId }],
    ['מפתח זר במסנן', { projectId, filter: { ...all, isOwner: true } }],
    ['מפתח זר בחודש', { projectId, filter: { period: { ...month, day: 1 } } }],
    ...[{ year: 1999, month: 12 }, { year: 2101, month: 1 }, { year: 2026, month: 0 }, { year: 2026, month: 13 }, { year: 2026, month: 1.5 }]
      .map((period): [string, unknown] => [`חודש ${period.year}-${period.month}`, { projectId, filter: { period } }]),
    ...[0, 32, -1, 1.5, NaN, Infinity, '2', null]
      .map((day): [string, unknown] => [`יום ${typeof day} ${day}`, { projectId, filter: { ...all, day } }]),
    ['חיפוש שאינו טקסט', { projectId, filter: { ...all, search: { formula: '1+1' } } }],
  ])('%s: VALIDATION לפני גישה לנתונים', async (_label, input) => {
    const { api, ctx, data } = fixture();
    expect(await api.renderWorkbook(ctx, input as never)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    for (const access of [mocks.getBook, render, ...Object.values(data)]) expect(access).not.toHaveBeenCalled();
  });
  it.each(Object.keys(statuses) as ErrorCode[])('כשל %s של getBook עובר בלי שינוי', async code => {
    const { api, ctx } = fixture();
    const denied = failure(code, { field: 'שדה בדוי' });
    mocks.getBook.mockResolvedValue(denied);
    expect(await api.renderWorkbook(ctx, { projectId, filter: { period: 'all' } })).toStrictEqual(denied);
    expect(render).not.toHaveBeenCalled();
  });
  it.each([
    ['נזרק מיד', () => { throw new TypeError('פנימי: פרויקט סודי 987654'); }],
    ['נדחה בהמשך', async () => { throw new Error('פנימי: פרויקט סודי 987654'); }],
  ] as const)('כשל מנוע ש%s הוא UNAVAILABLE בלי טקסט פנימי', async (_label, broken) => {
    const { api, ctx } = fixture();
    render.mockImplementationOnce(broken);
    expect(await api.renderWorkbook(ctx, { projectId, filter: { period: 'all' } })).toStrictEqual(failure('UNAVAILABLE'));
  });
});
