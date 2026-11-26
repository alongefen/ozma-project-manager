import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RequestContext } from '@/types/contracts';
import { failure } from '@/lib/db/rpc';
import { LeadRowSchema, LeadsApiInputSchemas as schemas, type LeadRow, type LeadsApi } from '@/types/contracts/leads';
import { filterLeads } from './filters';
import { ownerOperation, type LeadsPlatform } from './validation';

// Local schema for the proposed table only. No generated cloud types are changed before D31/application.
type DbRow = {
 id:string; revision:number; name:string; phone:string; canonical_phone:string; email:string|null;
 company_name:string|null; business_type:string|null; project_budget:string|null; has_designer:string; has_plan_set:string;
 source:string; marketing_company:string|null; inquiry_date:string; status:string; follow_up_date:string|null; notes:string|null;
 archived_at:string|null; deleted_at:string|null; created_at:string; updated_at:string; created_by:string; request_id:string;
};
type LeadsDatabase = {public:{Tables:{leads:{Row:DbRow;Insert:never;Update:never;Relationships:[]}};Views:Record<string,never>;Functions:Record<string,never>;Enums:Record<string,never>;CompositeTypes:Record<string,never>}};
function table(ctx: RequestContext) { return (ctx.db as unknown as SupabaseClient<LeadsDatabase>).from('leads'); }
function map(row: DbRow): LeadRow {
 return LeadRowSchema.parse({id:row.id,revision:row.revision,name:row.name,phone:row.phone,canonicalPhone:row.canonical_phone,email:row.email,companyName:row.company_name,businessType:row.business_type,projectBudget:row.project_budget,hasDesigner:row.has_designer,hasPlanSet:row.has_plan_set,source:row.source,marketingCompany:row.marketing_company,inquiryDate:row.inquiry_date,status:row.status,followUpDate:row.follow_up_date,notes:row.notes,archivedAt:row.archived_at,createdAt:row.created_at,updatedAt:row.updated_at,createdBy:row.created_by});
}
export function createLeadQueries(platform: LeadsPlatform) {
 return {
  listLeads:ownerOperation(platform,schemas.listLeads,async(ctx,input)=>{
   const rows=await platform.fetchAll(async(from,to)=>{
    const {data,error}=await table(ctx).select('*').is('deleted_at',null).order('inquiry_date',{ascending:false}).order('id',{ascending:false}).range(from,to);
    if(error) throw error;
    if(data===null) throw new Error('UNAVAILABLE');
    return data.map(map);
   });
   return {ok:true as const,value:filterLeads(rows,input,ctx.today)};
  }),
  getLead:ownerOperation(platform,schemas.getLead,async(ctx,input)=>{
   const {data,error}=await table(ctx).select('*').eq('id',input.id).is('deleted_at',null).maybeSingle();
   if(error) throw error;
   return data ? {ok:true as const,value:map(data)} : failure('NOT_FOUND');
  }),
 } satisfies Pick<LeadsApi,'listLeads'|'getLead'>;
}
