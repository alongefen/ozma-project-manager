import 'server-only';
import type { FinanceApi, Platform, RawMonthTotals, TransactionRow, RequestContext, Month, Money } from '@/types/contracts';
import { FinanceApiInputSchemas as inputs, RawMonthTotalsSchema, TransactionRowSchema } from '@/types/contracts/schemas';
import { failure, mapError } from '@/lib/db/rpc';
import * as money from '@/lib/money';
import type { Database } from '@/types/database';

// התאמה מבנית לחוזה הממוזג, בלי מנוע חישוב נוסף.
const calculator = money satisfies Money;
const index = (m: Month) => m.year * 12 + m.month;
const isIncome = (r: TransactionRow) => r.kind === 'income' || r.kind === 'income_refund';
const net = (r: TransactionRow) => BigInt(r.amount) * (r.kind === 'income_refund' || r.kind === 'expense_credit' ? -1n : 1n);
function safe(value: bigint) {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new RangeError('סכום מחוץ לטווח');
  return result;
}
function row(value: Database['public']['Tables']['transactions']['Row']): TransactionRow {
  return TransactionRowSchema.parse({ id: value.id, year: value.year, month: value.month, day: value.day, kind: value.kind,
    amount: value.amount, details: value.details, position: value.position, cancelledAt: value.cancelled_at, revision: value.revision });
}
export function createFinanceQueries(platform: Platform): Pick<FinanceApi, 'getBook' | 'listCancelled' | 'getAllProjectTotals'> {
  async function rows(ctx: RequestContext, projectId: string, cancelled: boolean) {
    return platform.fetchAll(async (from, to) => {
      let query = ctx.db.from('transactions').select('*').eq('project_id', projectId);
      query = cancelled ? query.not('cancelled_at', 'is', null) : query.is('cancelled_at', null);
      const result = await query.order('position').order('id').range(from, to);
      if (result.error) throw result.error;
      return (result.data ?? []).map(row);
    });
  }
  return {
    async getBook(ctx, input) {
      const parsed = inputs.getBook.safeParse(input);
      if (!parsed.success) return failure('VALIDATION');
      const { projectId, filter } = parsed.data;
      try {
        const permission = await platform.permissions.forProject(ctx, { projectId });
        if (!permission.ok) return permission;
        if (!permission.value.viewFinance) return failure('NOT_FOUND');
        const project = await ctx.db.from('projects').select('id,name').eq('id', projectId).single();
        if (project.error) {
          if (project.error.code === 'PGRST116') return failure('NOT_FOUND');
          throw project.error;
        }
        if (!project.data) return failure('NOT_FOUND');
        const totals = await platform.rpc<{projectId: string}, RawMonthTotals[]>(ctx, 'finance_month_totals', { projectId });
        if (!totals.ok) return totals;
        const allRows = await rows(ctx, projectId, false);
        const settings = await ctx.db.from('project_finance_settings').select('excel_url,revision').eq('project_id', projectId).single();
        if (settings.error || !settings.data) return failure('UNAVAILABLE');
        const period = filter.period;
        const months = calculator.buildMonths(totals.value.map(value => RawMonthTotalsSchema.parse(value)), period === 'all' ? undefined : period)
          .filter(value => period === 'all' || index(value) === index(period));
        const search = platform.format.searchKey(filter.search ?? '');
        const filtered = allRows.filter(r => (period === 'all' || index(r) === index(period)) &&
          (filter.day === undefined || r.day === filter.day) && (!search || platform.format.searchKey(r.details).includes(search)));
        const diaryInput: { projectId: string; from?: string; to?: string } = { projectId };
        if (period !== 'all') {
          const prefix = `${String(period.year).padStart(4, '0')}-${String(period.month).padStart(2, '0')}`;
          const days = [31, period.year % 4 === 0 && (period.year % 100 !== 0 || period.year % 400 === 0) ? 29 : 28,31,30,31,30,31,31,30,31,30,31];
          diaryInput.from = `${prefix}-01`; diaryInput.to = `${prefix}-${days[period.month - 1]}`;
        }
        const diary = await platform.rpc<typeof diaryInput, { workDays: number }>(ctx, 'diary_summary', diaryInput);
        if (!diary.ok) return diary;
        if (!Number.isSafeInteger(diary.value.workDays) || diary.value.workDays < 0) return failure('UNAVAILABLE');
        return { ok: true, value: {
          projectId, projectName: project.data.name, filter,
          months: months.map(summary => ({ summary, incomeRows: filtered.filter(r => index(r) === index(summary) && isIncome(r)), expenseRows: filtered.filter(r => index(r) === index(summary) && !isIncome(r)) })),
          period: calculator.summarizePeriod(months),
          filteredRows: { income: safe(filtered.filter(isIncome).reduce((s, r) => s + net(r), 0n)), expense: safe(filtered.filter(r => !isIncome(r)).reduce((s, r) => s + net(r), 0n)) },
          workDays: diary.value.workDays, excelLink: { url: settings.data.excel_url, revision: settings.data.revision },
          canWrite: permission.value.writeFinance, canCancel: permission.value.cancelTransaction,
        } };
      } catch (error) { return { ok: false, error: mapError(error) }; }
    },
    async listCancelled(ctx, input) {
      if (!inputs.listCancelled.safeParse(input).success) return failure('VALIDATION');
      try {
        const owner = await platform.permissions.requireOwner(ctx, {});
        if (!owner.ok) return owner;
        const permission = await platform.permissions.forProject(ctx, input);
        if (!permission.ok) return permission;
        if (!permission.value.viewFinance) return failure('NOT_FOUND');
        return { ok: true, value: await rows(ctx, input.projectId, true) };
      } catch (error) { return { ok: false, error: mapError(error) }; }
    },
    async getAllProjectTotals(ctx, input) {
      const parsed = inputs.getAllProjectTotals.safeParse(input);
      if (!parsed.success || (input.from && input.to && index(input.from) > index(input.to))) return failure('VALIDATION');
      try {
        const owner = await platform.permissions.requireOwner(ctx, {});
        if (!owner.ok) return owner;
        // כל ההיסטוריה לפני חיתוך הטווח, כדי לשמור יתרת פתיחה.
        const totals = await platform.rpc<Record<string, never>, (RawMonthTotals & { projectId: string; projectName: string })[]>(ctx, 'finance_all_month_totals', {});
        if (!totals.ok) return totals;
        const projects = new Map<string, { name: string; raw: RawMonthTotals[] }>();
        for (const value of totals.value) {
          const raw = RawMonthTotalsSchema.parse({ year: value.year, month: value.month, income: value.income, expense: value.expense });
          const project = projects.get(value.projectId) ?? { name: value.projectName, raw: [] };
          project.raw.push(raw); projects.set(value.projectId, project);
        }
        return { ok: true, value: [...projects].sort(([a], [b]) => a.localeCompare(b)).flatMap(([projectId, p]) =>
          calculator.buildMonths(p.raw, input.to).filter(m => (!input.from || index(m) >= index(input.from)) && (!input.to || index(m) <= index(input.to)))
            .map(month => ({ projectId, projectName: p.name, month }))) };
      } catch (error) { return { ok: false, error: mapError(error) }; }
    },
  };
}
