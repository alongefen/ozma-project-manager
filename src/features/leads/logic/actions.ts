'use server';
import type { LeadsApi } from '@/types/contracts/leads';
import { LeadsApiInputSchemas } from '@/types/contracts/leads';
import type { RequestContext, Result } from '@/types/contracts';
import { createPlatform } from '@/lib/auth/platform';
import { failure } from '@/lib/db/rpc';
import { createLeadsApi } from './index';
import { isLeadsAvailable } from './availability';

type Input<K extends keyof LeadsApi> = Parameters<LeadsApi[K]>[1];
type Output<K extends keyof LeadsApi> = Awaited<ReturnType<LeadsApi[K]>>;
async function invoke<K extends keyof LeadsApi>(method: K, input: Input<K>): Promise<Output<K>> {
  try {
    const platform = await createPlatform();
    const context = await platform.auth.getContext();
    if (!context.ok) return context as Output<K>;
    if (!isLeadsAvailable(context.value.actor.isOwner)) return failure('NOT_FOUND') as Output<K>;
    const parsed = LeadsApiInputSchemas[method].safeParse(input);
    if (!parsed.success) return failure('VALIDATION') as Output<K>;
    const operation = createLeadsApi(platform)[method] as (ctx: RequestContext, value: unknown) => Promise<Result<unknown>>;
    return await operation(context.value, parsed.data) as Output<K>;
  } catch { return failure('UNAVAILABLE') as Output<K>; }
}
export async function listLeads(input: Input<'listLeads'>) { return invoke('listLeads', input); }
export async function getLead(input: Input<'getLead'>) { return invoke('getLead', input); }
export async function createLead(input: Input<'createLead'>) { return invoke('createLead', input); }
export async function updateLead(input: Input<'updateLead'>) { return invoke('updateLead', input); }
export async function setLeadStatus(input: Input<'setLeadStatus'>) { return invoke('setLeadStatus', input); }
export async function setLeadArchived(input: Input<'setLeadArchived'>) { return invoke('setLeadArchived', input); }
export async function deleteLead(input: Input<'deleteLead'>) { return invoke('deleteLead', input); }
