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
