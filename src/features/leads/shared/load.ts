import 'server-only';
import { getContext, getPlatform } from '@/components/shell/request';
import { isLeadsAvailable } from '../logic/availability';
import { createLeadsApi } from '../logic';
/** No lead API is constructed until both active identity and availability pass. */
export async function loadLeads() {
  const context = await getContext();
  if (!context.ok || !isLeadsAvailable(context.value.actor.isOwner)) return null;
  const platform = await getPlatform();
  const result = await createLeadsApi(platform).listLeads(context.value, { archive: 'all' });
  if (!result.ok) throw new Error('leads unavailable');
  return { rows: result.value, today: context.value.today };
}
