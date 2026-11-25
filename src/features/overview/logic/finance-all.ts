import 'server-only';
import type { FinanceBook, FinanceFilter, Month, MonthBlock, MonthSummary, Platform, RequestContext, Result, TransactionRow } from '@/types/contracts';
import { TransactionRowSchema } from '@/types/contracts/schemas';
import { failure, mapError } from '@/lib/db/rpc';
import * as money from '@/lib/money';
import type { Database } from '@/types/database';
import { createFinanceApi } from '@/features/finance/logic';
import { percentTenths } from './queries';

const index = (m: Month) => m.year * 12 + m.month;
const isIncome = (r: TransactionRow) => r.kind === 'income' || r.kind === 'income_refund';
const net = (r: TransactionRow) => BigInt(r.amount) * (r.kind === 'income_refund' || r.kind === 'expense_credit' ? -1n : 1n);
function safe(value: bigint) {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new RangeError('סכום מחוץ לטווח');
  return result;
}
type Row = Database['public']['Tables']['transactions']['Row'];
const toRow = (v: Row): TransactionRow => TransactionRowSchema.parse({ id: v.id, year: v.year, month: v.month, day: v.day, kind: v.kind,
  amount: v.amount, details: v.details, position: v.position, cancelledAt: v.cancelled_at, revision: v.revision });

export type AllFinanceData = {
  /** The same shape as one project's book, summed over projects (or the one chosen project). Writable by the owner: the database still decides per project (finished projects refuse). */
  book: FinanceBook;
  filteredRows: FinanceBook['filteredRows'];
  /** `open`: the project accepts finance writes (not finished or archived). */
  projects: { id: string; name: string; open: boolean }[];
  /** Transaction id -> project name, for the project column. */
  projectOf: Record<string, string>;
  /** Transaction id -> project id, for edit and cancel. */
  projectIdOf: Record<string, string>;
  /** Cancelled transactions of the shown period and project (not in any total), for permanent delete. */
  cancelled: TransactionRow[];
  projectId: string | null;
};

/**
 * Finance of all projects in one book (owner only, P29: the database refuses everyone else in
 * `finance_all_month_totals`). Rows are read through RLS; month figures are the per-project, already rounded
 * summaries of the finance logic added up (A-07), so tax is the sum of the per-project taxes.
 */
export async function getAllFinance(platform: Platform, ctx: RequestContext, input: { filter: FinanceFilter; projectId?: string }): Promise<Result<AllFinanceData>> {
  const { filter } = input;
  try {
    const owner = await platform.permissions.requireOwner(ctx, {});
    if (!owner.ok) return owner;
    const projectsResult = await ctx.db.from('projects').select('id,name,status,archived_at').order('name').order('id');
    if (projectsResult.error) throw projectsResult.error;
    const projects = (projectsResult.data ?? []).map(p => ({ id: p.id, name: p.name, open: p.status === 'active' && !p.archived_at }));
    const chosen = input.projectId ? projects.find(p => p.id === input.projectId) : undefined;
    if (input.projectId && !chosen) return failure('NOT_FOUND');
    const period = filter.period;

    const [totals, allRows, cancelledRaw] = await Promise.all([
      createFinanceApi(platform).getAllProjectTotals(ctx, period === 'all' ? {} : { to: period }),
      platform.fetchAll(async (from, to) => {
        let query = ctx.db.from('transactions').select('*').is('cancelled_at', null);
        if (chosen) query = query.eq('project_id', chosen.id);
        const result = await query.order('position').order('id').range(from, to);
        if (result.error) throw result.error;
        return result.data ?? [];
      }),
      platform.fetchAll(async (from, to) => {
        let query = ctx.db.from('transactions').select('*').not('cancelled_at', 'is', null);
        if (chosen) query = query.eq('project_id', chosen.id);
        const result = await query.order('cancelled_at', { ascending: false }).order('id').range(from, to);
        if (result.error) throw result.error;
        return result.data ?? [];
      }),
    ]);
    if (!totals.ok) return totals;
    const names = new Map(projects.map(p => [p.id, p.name]));
    const projectOf: Record<string, string> = {};
    const projectIdOf: Record<string, string> = {};
    const rows: TransactionRow[] = [];
    for (const raw of allRows) {
      const r = toRow(raw);
      if (period !== 'all' && index(r) !== index(period)) continue;
      rows.push(r);
      projectOf[r.id] = names.get(raw.project_id) ?? '';
      projectIdOf[r.id] = raw.project_id;
    }
    const cancelled: TransactionRow[] = [];
    for (const raw of cancelledRaw) {
      const r = toRow(raw);
      if (period !== 'all' && index(r) !== index(period)) continue;
      cancelled.push(r);
      projectOf[r.id] = names.get(raw.project_id) ?? '';
      projectIdOf[r.id] = raw.project_id;
    }

    const sums = new Map<number, MonthSummary>();
    for (const { projectId, month } of totals.value) {
      if (chosen && projectId !== chosen.id) continue;
      if (period !== 'all' && index(month) !== index(period)) continue;
      const cur = sums.get(index(month));
      if (!cur) { sums.set(index(month), { ...month }); continue; }
      cur.income += month.income; cur.expense += month.expense; cur.tax += month.tax;
      cur.totalExpense += month.totalExpense; cur.netProfit += month.netProfit; cur.balance += month.balance;
      cur.profitPercentTenths = null;
    }
    const months = [...sums.values()].sort((a, b) => index(a) - index(b));
    for (const m of months) {
      if (![m.income, m.expense, m.tax, m.totalExpense, m.netProfit, m.balance].every(Number.isSafeInteger)) return failure('UNAVAILABLE');
      m.profitPercentTenths = percentTenths(m.netProfit, m.income);
    }

    const search = platform.format.searchKey(filter.search ?? '');
    const narrowed = rows.filter(r => (filter.day === undefined || r.day === filter.day) && (!search || platform.format.searchKey(r.details).includes(search)));
    const blocks: MonthBlock[] = months.map(summary => ({
      summary,
      incomeRows: rows.filter(r => index(r) === index(summary) && isIncome(r)),
      expenseRows: rows.filter(r => index(r) === index(summary) && !isIncome(r)),
    }));

    const diaryInput: { projectId?: string; from?: string; to?: string } = chosen ? { projectId: chosen.id } : {};
    if (period !== 'all') {
      const prefix = `${String(period.year).padStart(4, '0')}-${String(period.month).padStart(2, '0')}`;
      const leap = period.year % 4 === 0 && (period.year % 100 !== 0 || period.year % 400 === 0);
      const last = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][period.month - 1];
      diaryInput.from = `${prefix}-01`; diaryInput.to = `${prefix}-${last}`;
    }
    const diary = await platform.rpc<typeof diaryInput, { workDays: number }>(ctx, 'diary_summary', diaryInput);
    if (!diary.ok) return diary;
    if (!Number.isSafeInteger(diary.value.workDays) || diary.value.workDays < 0) return failure('UNAVAILABLE');

    const book: FinanceBook = {
      projectId: chosen?.id ?? '', projectName: chosen?.name ?? 'כל הפרויקטים', filter,
      months: blocks, period: money.summarizePeriod(months),
      filteredRows: { income: safe(narrowed.filter(isIncome).reduce((s, r) => s + net(r), 0n)), expense: safe(narrowed.filter(r => !isIncome(r)).reduce((s, r) => s + net(r), 0n)) },
      workDays: diary.value.workDays, excelLink: { url: null, revision: 1 }, canWrite: true, canCancel: true,
    };
    return { ok: true, value: { book, filteredRows: book.filteredRows, projects, projectOf, projectIdOf, cancelled, projectId: chosen?.id ?? null } };
  } catch (error) { return { ok: false, error: mapError(error) }; }
}
