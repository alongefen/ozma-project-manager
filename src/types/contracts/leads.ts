import { z } from 'zod';
import type { Operation, Saved } from './common';
import { UuidSchema, IsoDateSchema, IsoDateTimeSchema, EditSchema, SavedSchema } from './common';

export const leadStatuses = ['new', 'called', 'qualified', 'proposal_sent', 'won', 'irrelevant', 'denies_inquiry', 'no_answer'] as const;
export const leadSources = ['facebook', 'instagram', 'google_sheets', 'manual'] as const;
export const leadMarketingCompanies = ['new_company', 'previous_company'] as const;
export const LeadStatusSchema = z.enum(leadStatuses);
export const LeadSourceSchema = z.enum(leadSources);
export const LeadMarketingCompanySchema = z.enum(leadMarketingCompanies);
export const LeadTriStateSchema = z.enum(['yes', 'no', 'unknown']);
export type LeadStatus = z.infer<typeof LeadStatusSchema>;
export type LeadSource = z.infer<typeof LeadSourceSchema>;
export type LeadMarketingCompany = z.infer<typeof LeadMarketingCompanySchema>;
export type LeadTriState = z.infer<typeof LeadTriStateSchema>;
export const leadStatusLabels: Record<LeadStatus, string> = { new: 'חדש', called: 'בוצעה שיחה', qualified: 'רלוונטי להמשך', proposal_sent: 'נשלחה הצעת מחיר', won: 'נסגרה עבודה', irrelevant: 'לא רלוונטי', denies_inquiry: 'מכחיש פנייה', no_answer: 'אין מענה' };
export const leadSourceLabels = { facebook: 'פייסבוק', instagram: 'אינסטגרם', google_sheets: 'google sheets', manual: 'ידני' };
export const leadMarketingCompanyLabels = { new_company: 'חברת השיווק החדשה', previous_company: 'חברת השיווק הקודמת' };
export const leadTriStateLabels = { yes: 'כן', no: 'לא', unknown: 'לא ידוע' };
const optionalText = (max: number) => z.string().trim().min(1).max(max).nullable().default(null);
export const LeadFieldsSchema = z.strictObject({
  name: z.string().trim().min(1).max(200), phone: z.string().trim().min(1).max(80),
  email: z.email().max(254).nullable().default(null), companyName: optionalText(200), businessType: optionalText(200),
  projectBudget: optionalText(500), hasDesigner: LeadTriStateSchema.default('unknown'), hasPlanSet: LeadTriStateSchema.default('unknown'),
  source: LeadSourceSchema.default('manual'), marketingCompany: LeadMarketingCompanySchema.nullable().default(null),
  inquiryDate: IsoDateSchema, status: LeadStatusSchema.default('new'), followUpDate: IsoDateSchema.nullable().default(null), notes: optionalText(10000),
});
export type LeadFields = z.infer<typeof LeadFieldsSchema>;
export const LeadRowSchema = LeadFieldsSchema.extend({ id: UuidSchema, revision: z.number().int().positive(), canonicalPhone: z.string().min(1), archivedAt: IsoDateTimeSchema.nullable(), createdAt: IsoDateTimeSchema, updatedAt: IsoDateTimeSchema, createdBy: UuidSchema });
export type LeadRow = z.infer<typeof LeadRowSchema>;
export const LeadFiltersSchema = z.strictObject({ search: z.string().trim().max(200).default(''), marketingCompany: LeadMarketingCompanySchema.optional(), statuses: z.array(LeadStatusSchema).max(8).default([]), dueOnly: z.boolean().default(false), archive: z.enum(['active', 'archived', 'all']).default('active') });
export type LeadFilters = z.infer<typeof LeadFiltersSchema>;
export const CreateLeadSchema = LeadFieldsSchema.extend({ requestId: UuidSchema, allowDuplicate: z.boolean().default(false) });
export const UpdateLeadSchema = z.strictObject({ ...EditSchema.shape, fields: LeadFieldsSchema });
export const CreateLeadOutcomeSchema = z.discriminatedUnion('kind', [z.strictObject({ kind: z.literal('saved'), saved: SavedSchema }), z.strictObject({ kind: z.literal('duplicate'), duplicateCount: z.number().int().positive() })]);
export type CreateLeadOutcome = z.infer<typeof CreateLeadOutcomeSchema>;
export const LeadsApiInputSchemas = {
  listLeads: LeadFiltersSchema, getLead: z.strictObject({id: UuidSchema}), createLead: CreateLeadSchema, updateLead: UpdateLeadSchema,
  setLeadStatus: EditSchema.extend({ status: LeadStatusSchema }), setLeadArchived: EditSchema.extend({ archived: z.boolean() }), deleteLead: EditSchema,
};
export type CreateLeadInput = z.input<typeof CreateLeadSchema>;
export type UpdateLeadInput = z.input<typeof UpdateLeadSchema>;
export type LeadFiltersInput = z.input<typeof LeadFiltersSchema>;
export type SetLeadStatusInput = z.infer<typeof LeadsApiInputSchemas.setLeadStatus>;
export type SetLeadArchivedInput = z.infer<typeof LeadsApiInputSchemas.setLeadArchived>;
export type LeadsApi = {
  listLeads: Operation<LeadFiltersInput, LeadRow[]>;
  getLead: Operation<{id: string}, LeadRow>;
  createLead: Operation<CreateLeadInput, CreateLeadOutcome>;
  updateLead: Operation<UpdateLeadInput, Saved>;
  setLeadStatus: Operation<z.infer<typeof LeadsApiInputSchemas.setLeadStatus>, Saved>;
  setLeadArchived: Operation<z.infer<typeof LeadsApiInputSchemas.setLeadArchived>, Saved>;
  deleteLead: Operation<z.infer<typeof EditSchema>, Saved>;
};
