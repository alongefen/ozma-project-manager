import 'server-only';
import type { Saved } from '@/types/contracts';
import { SavedSchema } from '@/types/contracts/common';
import { LeadsApiInputSchemas as schemas, CreateLeadOutcomeSchema, type LeadsApi, type CreateLeadOutcome } from '@/types/contracts/leads';
import { ownerOperation, type LeadsPlatform } from './validation';
export function createLeadCommands(platform: LeadsPlatform) {
  return {
    createLead: ownerOperation(platform, schemas.createLead, async (ctx, input) => {
      const result = await platform.rpc<typeof input, CreateLeadOutcome>(ctx, 'create_lead', input);
      return result.ok ? { ok: true as const, value: CreateLeadOutcomeSchema.parse(result.value) } : result;
    }),
    updateLead: ownerOperation(platform, schemas.updateLead, async (ctx, input) => {
      const result = await platform.rpc<typeof input, Saved>(ctx, 'update_lead', input);
      return result.ok ? { ok: true as const, value: SavedSchema.parse(result.value) } : result;
    }),
    setLeadStatus: ownerOperation(platform, schemas.setLeadStatus, async (ctx, input) => {
      const result = await platform.rpc<typeof input, Saved>(ctx, 'set_lead_status', input);
      return result.ok ? { ok: true as const, value: SavedSchema.parse(result.value) } : result;
    }),
    setLeadArchived: ownerOperation(platform, schemas.setLeadArchived, async (ctx, input) => {
      const result = await platform.rpc<typeof input, Saved>(ctx, 'set_lead_archived', input);
      return result.ok ? { ok: true as const, value: SavedSchema.parse(result.value) } : result;
    }),
    deleteLead: ownerOperation(platform, schemas.deleteLead, async (ctx, input) => {
      const result = await platform.rpc<typeof input, Saved>(ctx, 'delete_lead', input);
      return result.ok ? { ok: true as const, value: SavedSchema.parse(result.value) } : result;
    }),
  } satisfies Omit<LeadsApi, 'listLeads' | 'getLead'>;
}
