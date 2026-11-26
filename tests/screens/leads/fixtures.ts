import { LeadFieldsSchema, type LeadRow } from '@/types/contracts/leads';
export const today='2026-11-26';
export function row(n:number,patch:Partial<LeadRow>={}):LeadRow{return {...LeadFieldsSchema.parse({name:`ליד בדוי ${n}`,phone:`050000000${n}`,inquiryDate:today}),id:`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`,canonicalPhone:`+97250000000${n}`,revision:1,archivedAt:null,createdAt:'2026-11-26T08:00:00Z',updatedAt:'2026-11-26T08:00:00Z',createdBy:'11111111-1111-4111-8111-111111111111',...patch};}
