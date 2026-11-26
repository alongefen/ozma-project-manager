import { describe, it, expect } from 'vitest';
import { CreateLeadSchema, LeadFiltersSchema } from '../../../src/types/contracts/leads';
import { canonicalPhone } from '../../../src/features/leads/logic/phone';
const base = { requestId: '27f5161e-b0d8-47e2-8383-2bf19087b718', name: 'ליד בדיקה', phone: '050-000-0000', inquiryDate: '2026-11-26' };
describe('lead contract', () => {
  it('accepts optional free text budget and defaults', () => {
    expect(CreateLeadSchema.parse({...base, projectBudget: 'כמיליון עד שני מיליון'})).toMatchObject({status:'new',source:'manual',hasDesigner:'unknown',marketingCompany:null});
  });
  it.each([{name:''},{phone:'  '},{inquiryDate:'2026-02-30'},{inquiryDate:''},{email:''},{companyName:''},{status:'other'},{source:'webhook'},{projectId:base.requestId},{createdBy:base.requestId}])('rejects invalid/unauthorized field %j', change => expect(CreateLeadSchema.safeParse({...base,...change}).success).toBe(false));
  it('rejects missing required date', () => expect(CreateLeadSchema.safeParse({...base,inquiryDate:undefined}).success).toBe(false));
  it('defaults to active archive view', () => expect(LeadFiltersSchema.parse({}).archive).toBe('active'));
  it.each(['050-000-0000','(050) 000 0000','+972 50 000 0000','00972-50-000-0000','+972 (0)50 0000000'])('normalizes %s', phone => expect(canonicalPhone(phone)).toBe('0500000000'));
  it('does not impose national number restrictions', () => expect(canonicalPhone('+1 202-555-0123')).toBe('+12025550123'));
});
