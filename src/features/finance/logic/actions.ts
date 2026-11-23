'use server';
import type { FinanceApi, Operation, Result } from '@/types/contracts';
import { createPlatform } from '@/lib/auth/platform';
import { failure } from '@/lib/db/rpc';
import { createFinanceApi } from './index';

type Input<K extends keyof FinanceApi> = FinanceApi[K] extends Operation<infer I, unknown> ? I : never;
async function invoke<I, O>(select: (api: FinanceApi) => Operation<I, O>, input: I): Promise<Result<O>> {
  try {
    const platform = await createPlatform();
    const context = await platform.auth.getContext();
    if (!context.ok) return context;
    const operation = select(createFinanceApi(platform));
    return await operation(context.value, input);
  } catch { return failure('UNAVAILABLE'); }
}
export async function getBook(input: Input<'getBook'>) { return invoke(api => api.getBook, input); }
export async function listCancelled(input: Input<'listCancelled'>) { return invoke(api => api.listCancelled, input); }
export async function getAllProjectTotals(input: Input<'getAllProjectTotals'>) { return invoke(api => api.getAllProjectTotals, input); }
export async function createTransaction(input: Input<'createTransaction'>) { return invoke(api => api.createTransaction, input); }
export async function updateTransaction(input: Input<'updateTransaction'>) { return invoke(api => api.updateTransaction, input); }
export async function cancelTransaction(input: Input<'cancelTransaction'>) { return invoke(api => api.cancelTransaction, input); }
export async function setExcelLink(input: Input<'setExcelLink'>) { return invoke(api => api.setExcelLink, input); }
