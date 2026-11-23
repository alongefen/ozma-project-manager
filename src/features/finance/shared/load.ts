import 'server-only';
import type { FinanceBook, FinanceFilter, Platform, RequestContext } from '@/types/contracts';
import { createFinanceApi } from '../logic';

export type FinanceScreenData =
  | { kind: 'ok'; book: FinanceBook }
  /** No finance for this person on this project: the page answers 404 and shows no numbers at all. */
  | { kind: 'hidden' }
  | { kind: 'signed-out' }
  | { kind: 'error'; message: string };

export async function loadFinance(platform: Platform, ctx: RequestContext, projectId: string, filter: FinanceFilter): Promise<FinanceScreenData> {
  const result = await createFinanceApi(platform).getBook(ctx, { projectId, filter });
  if (result.ok) return { kind: 'ok', book: result.value };
  const code = result.error.code;
  if (code === 'NOT_FOUND' || code === 'FORBIDDEN' || code === 'VALIDATION') return { kind: 'hidden' };
  if (code === 'UNAUTHENTICATED') return { kind: 'signed-out' };
  return { kind: 'error', message: result.error.message };
}

export type FinanceScreen =
  | { kind: 'ok'; book: FinanceBook; filteredRows: FinanceBook['filteredRows'] }
  | { kind: 'hidden' }
  | { kind: 'signed-out' }
  | { kind: 'error'; message: string };

/**
 * The book of the whole period (all its rows, so the screen can narrow them locally) and, only when a day or
 * text filter is active, the server-calculated totals of the narrowed rows, fetched in parallel.
 */
export async function loadFinanceScreen(platform: Platform, ctx: RequestContext, projectId: string, filter: FinanceFilter): Promise<FinanceScreen> {
  const narrowed = filter.day !== undefined || !!filter.search;
  const [base, filtered] = await Promise.all([
    loadFinance(platform, ctx, projectId, { period: filter.period }),
    narrowed ? loadFinance(platform, ctx, projectId, filter) : Promise.resolve(null),
  ]);
  if (base.kind !== 'ok') return base;
  if (filtered && filtered.kind !== 'ok') return filtered;
  return { kind: 'ok', book: base.book, filteredRows: filtered ? filtered.book.filteredRows : base.book.filteredRows };
}
