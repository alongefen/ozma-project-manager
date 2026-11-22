'use server';

import type { ActionsOf, DiaryApi, Result, RequestContext } from '@/types/contracts';
import { createPlatform } from '@/lib/auth/platform';
import { failure } from '@/lib/db/rpc';
import { createDiaryApi } from './service';

type Input<K extends keyof DiaryApi> = Parameters<ActionsOf<DiaryApi>[K]>[0];
async function execute<K extends keyof DiaryApi>(name: K, input: Input<K>): Promise<Awaited<ReturnType<ActionsOf<DiaryApi>[K]>>> {
  type Output = Awaited<ReturnType<ActionsOf<DiaryApi>[K]>>;
  try {
    const platform = await createPlatform();
    const ctx = await platform.auth.getContext();
    if (!ctx.ok) return ctx as Output;
    // Public actions accept input only. The context always comes from the authenticated server request.
    const operation = createDiaryApi(platform)[name] as (context: RequestContext, value: Input<K>) => Promise<Result<unknown>>;
    return await operation(ctx.value, input) as Output;
  } catch { return failure('UNAVAILABLE') as Output; }
}
export async function listEntries(input: Input<'listEntries'>) { return execute('listEntries', input); }
export async function getSummary(input: Input<'getSummary'>) { return execute('getSummary', input); }
export async function getEntry(input: Input<'getEntry'>) { return execute('getEntry', input); }
export async function listVersions(input: Input<'listVersions'>) { return execute('listVersions', input); }
export async function listForReport(input: Input<'listForReport'>) { return execute('listForReport', input); }
export async function createEntry(input: Input<'createEntry'>) { return execute('createEntry', input); }
export async function correctEntry(input: Input<'correctEntry'>) { return execute('correctEntry', input); }
export async function moveEntry(input: Input<'moveEntry'>) { return execute('moveEntry', input); }
export async function cancelEntry(input: Input<'cancelEntry'>) { return execute('cancelEntry', input); }
