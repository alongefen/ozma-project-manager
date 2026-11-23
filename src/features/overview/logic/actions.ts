'use server';
import type { ActionsOf, OverviewApi, Result, RequestContext } from '@/types/contracts';
import { createPlatform } from '@/lib/auth/platform';
import { failure } from '@/lib/db/rpc';
import { createProjectsApi } from '@/features/projects/logic';
import { createDiaryApi } from '@/features/diary/logic';
import { createFinanceApi } from '@/features/finance/logic';
import { createOverviewApi } from './index';

type Input<K extends keyof OverviewApi> = Parameters<OverviewApi[K]>[1];
type Output<K extends keyof OverviewApi> = Awaited<ReturnType<OverviewApi[K]>> extends Result<infer O> ? O : never;

async function execute<K extends keyof OverviewApi>(name: K, input: Input<K>): Promise<Result<Output<K>>> {
  try {
    const platform = await createPlatform();
    const context = await platform.auth.getContext();
    if (!context.ok) return context;
    const api = createOverviewApi(platform, {
      projects: createProjectsApi(platform), diary: createDiaryApi(platform), finance: createFinanceApi(platform),
    });
    const operation = api[name] as (ctx: RequestContext, input: Input<K>) => Promise<Result<Output<K>>>;
    return await operation(context.value, input);
  } catch { return failure('UNAVAILABLE'); }
}

export async function getHome(input: Input<'getHome'>) { return execute('getHome', input); }
export async function getTransferSummary(input: Input<'getTransferSummary'>) { return execute('getTransferSummary', input); }

const actions = { getHome, getTransferSummary } satisfies ActionsOf<OverviewApi>;
void actions;
