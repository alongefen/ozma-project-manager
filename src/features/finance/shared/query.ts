import type { FinanceFilter, IsoDate, Month } from '@/types/contracts';

/** Screen state lives in the URL: period (YYYY-MM or all), optional day and search text. */
export type FinanceQuery = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function monthKey(month: Month): string {
  return `${String(month.year).padStart(4, '0')}-${String(month.month).padStart(2, '0')}`;
}

/** Current month from the server's Israel date (never the browser clock). */
export function currentMonth(today: IsoDate): Month {
  return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
}

/** Default is the whole period: no filter at all. */
export function parseFilter(query: FinanceQuery): FinanceFilter {
  const period = first(query.period);
  const match = period ? /^(\d{4})-(\d{2})$/.exec(period) : null;
  const month = match ? { year: Number(match[1]), month: Number(match[2]) } : null;
  const valid = month && month.year >= 2000 && month.year <= 2100 && month.month >= 1 && month.month <= 12;
  const filter: FinanceFilter = { period: valid ? month : 'all' };
  const day = first(query.day);
  if (day && /^\d{1,2}$/.test(day) && Number(day) >= 1 && Number(day) <= 31) filter.day = Number(day);
  const search = first(query.search)?.trim();
  if (search) filter.search = search.slice(0, 200);
  return filter;
}

export function filterParams(filter: FinanceFilter): URLSearchParams {
  const params = new URLSearchParams();
  params.set('period', filter.period === 'all' ? 'all' : monthKey(filter.period));
  if (filter.day !== undefined) params.set('day', String(filter.day));
  if (filter.search) params.set('search', filter.search);
  return params;
}

export function financeHref(projectId: string, filter: FinanceFilter): string {
  return `/projects/${projectId}/finance?${filterParams(filter)}`;
}

export function exportHref(projectId: string, filter: FinanceFilter): string {
  const params = filterParams(filter);
  params.set('projectId', projectId);
  return `/api/exports/finance?${params}`;
}

/** The all-projects page: same filter params plus an optional `project`. */
export const ALL_FINANCE_PATH = '/finance';

export function allFinanceHref(filter: FinanceFilter, project?: string | null): string {
  const params = filterParams(filter);
  if (project) params.set('project', project);
  return `${ALL_FINANCE_PATH}?${params}`;
}

export function allExportHref(filter: FinanceFilter, project?: string | null): string {
  const params = filterParams(filter);
  if (project) params.set('project', project);
  return `${ALL_FINANCE_PATH}/export?${params}`;
}

/** Year choices around the current one, always including the selected year. */
export function yearOptions(today: IsoDate, selected?: number): number[] {
  const current = Number(today.slice(0, 4));
  const years = new Set<number>();
  for (let y = current - 4; y <= current + 1; y++) years.add(y);
  if (selected) years.add(selected);
  return [...years].sort((a, b) => b - a);
}

/** Desktop filter popup values (month, year, day) to a filter; the live search stays. An empty month means the whole period. */
export function periodFilterFromValues(values: FormData, base: Month, search?: string): FinanceFilter {
  const month = String(values.get('month') ?? '');
  const year = String(values.get('year') ?? '');
  const day = String(values.get('day') ?? '').trim();
  const d = Number(day);
  const next: FinanceFilter = { period: month ? { year: Number(year || base.year), month: Number(month) } : 'all' };
  if (day && Number.isInteger(d) && d >= 1 && d <= 31) next.day = d;
  if (search) next.search = search;
  return next;
}

/** Phone filter popup values (project, day, search) to a filter (the period has its own switch) and the chosen project. */
export function phoneFilterFromValues(values: FormData, period: FinanceFilter['period']): { filter: FinanceFilter; project: string | null } {
  const filter: FinanceFilter = { period };
  const day = String(values.get('day') ?? '').trim();
  const d = Number(day);
  if (day && Number.isInteger(d) && d >= 1 && d <= 31) filter.day = d;
  const search = String(values.get('search') ?? '').trim();
  if (search) filter.search = search;
  return { filter, project: String(values.get('project') ?? '') || null };
}
