import 'server-only';
import type { FinanceApi, Platform } from '@/types/contracts';
import { createFinanceQueries } from './queries';
import { createFinanceCommands } from './commands';
export function createFinanceApi(platform: Platform): FinanceApi {
  return { ...createFinanceQueries(platform), ...createFinanceCommands(platform) } satisfies FinanceApi;
}
