import 'server-only';
import type { OverviewApi, Platform } from '@/types/contracts';
import { createOverviewQueries, type OverviewDeps } from './queries';

export type { OverviewDeps };
export function createOverviewApi(platform: Platform, deps: OverviewDeps): OverviewApi {
  return createOverviewQueries(platform, deps) satisfies OverviewApi;
}
