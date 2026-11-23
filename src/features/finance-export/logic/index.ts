import 'server-only';
import type { FinanceExportApi, Platform } from '@/types/contracts';
import { createFinanceExportQueries } from './queries';

export function createFinanceExportApi(platform: Platform): FinanceExportApi {
  return createFinanceExportQueries(platform) satisfies FinanceExportApi;
}
