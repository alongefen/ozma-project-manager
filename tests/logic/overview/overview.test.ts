import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { DiaryApi, FinanceApi, MonthSummary, Platform, ProjectCard, ProjectsApi, RequestContext } from '../../../src/types/contracts';
vi.mock('server-only', () => ({}));
import { createOverviewApi } from '../../../src/features/overview/logic';
import { format } from '../../../src/lib/format';

const card = (over: Partial<ProjectCard> = {}): ProjectCard => ({
  id: randomUUID(), name: 'פרויקט בדוי', businessName: 'עסק א', siteAddress: 'רחוב', status: 'active',
  archived: false, coverFileId: null, reportCount: 0, openTaskCount: 0, ...over,
});
const month = (year: number, m: number, income: number, expense: number, tax: number): MonthSummary => ({
  year, month: m, income, expense, tax, totalExpense: expense + tax, netProfit: income - expense - tax,
  profitPercentTenths: income > 0 ? Math.round(((income - expense - tax) * 1000) / income) : null, balance: 0,
});
const denied = { ok: false, error: { code: 'NOT_FOUND', message: 'x' } } as const;

function fixture(owner: boolean, cards: ProjectCard[], totals: { projectId: string; projectName: string; month: MonthSummary }[] = [], mineRows: { id: string; project_id: string }[] = []) {
  const listProjects = vi.fn().mockResolvedValue({ ok: true, value: cards });
  const getSummary = vi.fn().mockResolvedValue({ ok: true, value: { reportCount: 3, workDays: 1, byProject: [] } });
  const getAllProjectTotals = vi.fn().mockResolvedValue({ ok: true, value: totals });
  const requireOwner = vi.fn().mockResolvedValue(owner ? { ok: true, value: null } : denied);
  const platform = { format, permissions: { requireOwner }, fetchAll: vi.fn().mockResolvedValue(mineRows) } as unknown as Platform;
  const api = createOverviewApi(platform, {
    projects: { listProjects } as unknown as ProjectsApi,
    diary: { getSummary } as unknown as DiaryApi,
    finance: { getAllProjectTotals } as unknown as FinanceApi,
  });
  const ctx: RequestContext = { db: {} as never, actor: { userId: randomUUID(), fullName: 'בדוי', email: 'test@example.invalid', isOwner: owner }, today: '2026-11-22' };
  return { api, ctx, listProjects, getSummary, getAllProjectTotals, requireOwner };
}

describe('getHome counters and badges', () => {
  it('counts only active non-archived projects; tasks sum their badges; customers deduped by search key', async () => {
    const cards = [
      card({ businessName: 'עסק  א', openTaskCount: 2 }),
      card({ businessName: 'עסק א', openTaskCount: 3, status: 'completed' }),
      card({ businessName: 'עסק "ב"', openTaskCount: 1 }),
      card({ businessName: 'עסק ארכיון', openTaskCount: 9, archived: true }),
    ];
    const { api, ctx, getSummary } = fixture(true, cards);
    const result = await api.getHome(ctx, {});
    expect(result).toMatchObject({ ok: true, value: { counters: { activeProjects: 2, reportsToday: 3, customers: 2, openTasks: 6 } } });
    if (result.ok) expect(result.value.projects.map(p => p.id)).toEqual(cards.slice(0, 3).map(p => p.id));
    expect(getSummary).toHaveBeenCalledWith(ctx, { from: '2026-11-22', to: '2026-11-22' });
  });
  it('a non-owner counts only the open tasks assigned to them, and links the project when all are in one (A-46)', async () => {
    const cards = [card({ openTaskCount: 5 }), card({ openTaskCount: 4 })];
    const one = fixture(false, cards, [], [{ id: 't1', project_id: cards[0].id }, { id: 't2', project_id: cards[0].id }, { id: 'x', project_id: randomUUID() }]);
    expect(await one.api.getHome(one.ctx, {})).toMatchObject({ ok: true, value: { counters: { openTasks: 2, myOpenTasks: 2, myTasksProjectId: cards[0].id } } });
    const two = fixture(false, cards, [], [{ id: 't1', project_id: cards[0].id }, { id: 't2', project_id: cards[1].id }]);
    expect(await two.api.getHome(two.ctx, {})).toMatchObject({ ok: true, value: { counters: { openTasks: 2, myTasksProjectId: null } } });
  });
  it('the owner gets both numbers: all open tasks and their own (0 when none) (A-46)', async () => {
    const cards = [card({ openTaskCount: 5 })];
    const none = fixture(true, cards);
    expect(await none.api.getHome(none.ctx, {})).toMatchObject({ ok: true, value: { counters: { openTasks: 5, allOpenTasks: 5, allTasksProjectId: cards[0].id, myOpenTasks: 0, myTasksProjectId: null } } });
    const worker = fixture(false, cards);
    expect(await worker.api.getHome(worker.ctx, {})).toMatchObject({ ok: true, value: { counters: { allOpenTasks: null, allTasksProjectId: null } } });
  });
  it('shows zeros for a worker with no visible projects', async () => {
    const { api, ctx } = fixture(false, []);
    expect(await api.getHome(ctx, {})).toMatchObject({ ok: true, value: { counters: { activeProjects: 0, customers: 0, openTasks: 0 }, projects: [], financeCube: null } });
  });
  it('rejects non-empty input and propagates dependency failures', async () => {
    const { api, ctx, listProjects } = fixture(false, []);
    expect(await api.getHome(ctx, { x: 1 } as never)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    listProjects.mockResolvedValue({ ok: false, error: { code: 'UNAUTHENTICATED', message: 'x' } });
    expect(await api.getHome(ctx, {})).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } });
  });
});

describe('finance cube (owner only)', () => {
  it('never reads finance for non-owners, even managers with finance access', async () => {
    const { api, ctx, getAllProjectTotals } = fixture(false, [card()]);
    const result = await api.getHome(ctx, {});
    expect(result).toMatchObject({ ok: true, value: { financeCube: null } });
    expect(getAllProjectTotals).not.toHaveBeenCalled();
  });
  it('sums the current month of every project, summing already-rounded taxes', async () => {
    const a = randomUUID(), b = randomUUID();
    const { api, ctx, getAllProjectTotals } = fixture(true, [card()], [
      { projectId: a, projectName: 'א', month: month(2026, 11, 100005, 20000, 3000) },
      { projectId: b, projectName: 'ב', month: month(2026, 11, 50005, 10000, 1500) },
    ]);
    const result = await api.getHome(ctx, {});
    expect(getAllProjectTotals).toHaveBeenCalledWith(ctx, { from: { year: 2026, month: 11 }, to: { year: 2026, month: 11 } });
    expect(result).toMatchObject({ ok: true, value: { financeCube: {
      month: { year: 2026, month: 11 }, income: 150010, expense: 30000, tax: 4500, totalExpense: 34500, netProfit: 115510, profitPercentTenths: 770,
    } } });
  });
  it('returns an empty cube when there is no finance data and fails closed on finance errors', async () => {
    const { api, ctx, getAllProjectTotals } = fixture(true, []);
    expect(await api.getHome(ctx, {})).toMatchObject({ ok: true, value: { financeCube: { income: 0, tax: 0, netProfit: 0, profitPercentTenths: null } } });
    getAllProjectTotals.mockResolvedValue(denied);
    expect(await api.getHome(ctx, {})).toMatchObject({ ok: false });
  });
});

describe('getTransferSummary', () => {
  it('groups by month; transfer is the sum of per-project rounded taxes, including all projects', async () => {
    const a = randomUUID(), b = randomUUID();
    const { api, ctx } = fixture(true, [], [
      { projectId: a, projectName: 'א', month: month(2026, 10, 100005, 0, 3000) },
      { projectId: b, projectName: 'ב', month: month(2026, 10, 100005, 0, 3000) },
      { projectId: a, projectName: 'א', month: month(2026, 11, 50000, 0, 1500) },
    ]);
    const result = await api.getTransferSummary(ctx, {});
    expect(result).toMatchObject({ ok: true, value: [
      { month: { year: 2026, month: 10 }, transferAmount: 6000 },
      { month: { year: 2026, month: 11 }, transferAmount: 1500 },
    ] });
    if (result.ok) {
      expect(result.value[0].projects.map(p => p.projectId)).toEqual([a, b]);
      for (const m of result.value) expect(m.transferAmount).toBe(m.projects.reduce((s, p) => s + p.summary.tax, 0));
    }
  });
  it('is refused for non-owners before any finance read', async () => {
    const { api, ctx, getAllProjectTotals } = fixture(false, []);
    expect(await api.getTransferSummary(ctx, {})).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(getAllProjectTotals).not.toHaveBeenCalled();
  });
  it('validates input and forwards the range', async () => {
    const { api, ctx, getAllProjectTotals } = fixture(true, []);
    expect(await api.getTransferSummary(ctx, { from: { year: 2026, month: 13 } })).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    await api.getTransferSummary(ctx, { from: { year: 2026, month: 1 }, to: { year: 2026, month: 3 } });
    expect(getAllProjectTotals).toHaveBeenCalledWith(ctx, { from: { year: 2026, month: 1 }, to: { year: 2026, month: 3 } });
  });
});
