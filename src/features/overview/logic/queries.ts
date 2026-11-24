import 'server-only';
import type { DiaryApi, FinanceApi, Month, MoneySummary, OverviewApi, Platform, ProjectsApi } from '@/types/contracts';
import { OverviewApiInputSchemas as schemas } from '@/types/contracts/schemas';
import { failure } from '@/lib/db/rpc';
import { validated } from '@/features/projects/logic/validation';

export type OverviewDeps = { projects: ProjectsApi; diary: DiaryApi; finance: FinanceApi };

const monthKey = (m: Month) => m.year * 12 + m.month;

// Half away from zero, same rule as src/lib/money; only the ratio is derived here,
// all amounts come from the already-rounded per-project summaries of FinanceApi.
export function percentTenths(net: number, income: number): number | null {
  if (income <= 0) return null;
  const scaled = Math.abs(net) * 1000;
  const rounded = Math.floor((scaled * 2 + income) / (income * 2));
  return net < 0 ? -rounded : rounded;
}

export function createOverviewQueries(platform: Platform, deps: OverviewDeps): OverviewApi {
  return {
    getHome: validated(schemas.getHome, async ctx => {
      const listed = await deps.projects.listProjects(ctx, {});
      if (!listed.ok) return listed;
      // Cards come from RLS-filtered data, so only projects the actor may see are counted (PERM-03).
      const visible = listed.value.filter(card => !card.archived);
      const summary = await deps.diary.getSummary(ctx, { from: ctx.today, to: ctx.today });
      if (!summary.ok) return summary;
      const customers = new Set(visible.map(card => platform.format.searchKey(card.businessName)));
      let financeCube: Cube | null = null;
      if (ctx.actor.isOwner) {
        const [year, month] = [Number(ctx.today.slice(0, 4)), Number(ctx.today.slice(5, 7))];
        const current = { year, month };
        const totals = await deps.finance.getAllProjectTotals(ctx, { from: current, to: current });
        if (!totals.ok) return totals;
        let income = 0, expense = 0, tax = 0;
        for (const { month: m } of totals.value) {
          if (monthKey(m) !== monthKey(current)) continue;
          income += m.income; expense += m.expense; tax += m.tax;
        }
        if (![income, expense, tax].every(Number.isSafeInteger)) return failure('UNAVAILABLE');
        const totalExpense = expense + tax;
        const netProfit = income - totalExpense;
        financeCube = { month: current, income, expense, tax, totalExpense, netProfit, profitPercentTenths: percentTenths(netProfit, income) };
      }
      return { ok: true, value: {
        counters: {
          activeProjects: visible.filter(card => card.status === 'active').length,
          reportsToday: summary.value.reportCount,
          customers: customers.size,
          openTasks: visible.reduce((sum, card) => sum + card.openTaskCount, 0),
        },
        projects: visible,
        financeCube,
      } };
    }),
    getTransferSummary: validated(schemas.getTransferSummary, async (ctx, input) => {
      const owner = await platform.permissions.requireOwner(ctx, {});
      if (!owner.ok) return owner;
      const totals = await deps.finance.getAllProjectTotals(ctx, input);
      if (!totals.ok) return totals;
      const byMonth = new Map<number, { month: Month; transferAmount: number; projects: { projectId: string; projectName: string; summary: (typeof totals.value)[number]['month'] }[] }>();
      for (const row of totals.value) {
        const key = monthKey(row.month);
        const entry = byMonth.get(key) ?? { month: { year: row.month.year, month: row.month.month }, transferAmount: 0, projects: [] };
        entry.transferAmount += row.month.tax; // A-07: sum of per-project rounded taxes
        entry.projects.push({ projectId: row.projectId, projectName: row.projectName, summary: row.month });
        byMonth.set(key, entry);
      }
      const value = [...byMonth].sort(([a], [b]) => a - b).map(([, entry]) => entry);
      if (!value.every(entry => Number.isSafeInteger(entry.transferAmount))) return failure('UNAVAILABLE');
      return { ok: true, value };
    }),
  };
}

type Cube = MoneySummary & { month: Month };
