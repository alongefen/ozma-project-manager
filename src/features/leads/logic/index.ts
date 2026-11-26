import 'server-only';
import type { LeadsApi } from '@/types/contracts/leads';
import { createLeadQueries } from './queries';
import { createLeadCommands } from './commands';
import type { LeadsPlatform } from './validation';
export function createLeadsApi(platform: LeadsPlatform): LeadsApi {
  return { ...createLeadQueries(platform), ...createLeadCommands(platform) } satisfies LeadsApi;
}
