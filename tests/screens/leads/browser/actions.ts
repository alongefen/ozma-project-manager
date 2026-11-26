import type { CreateLeadInput, LeadFields, LeadRow, SetLeadStatusInput, SetLeadArchivedInput, UpdateLeadInput } from '@/types/contracts/leads';
import { row } from '../fixtures';
const ok=<T,>(value:T)=>({ok:true as const,value});
const failure=(code:string)=>({ok:false as const,error:{code,message:'fixture'}});
export const fixture={rows:[row(1,{companyName:'חברה בדויה',followUpDate:'2026-11-25'}),row(2,{status:'won'}),row(3,{archivedAt:'2026-11-26T08:00:00Z'})],calls:[] as {method:string;input:unknown}[],failNext:'',delay:0};
Object.assign(window,{leadsFixture:fixture});
async function call(method:string,input:unknown){fixture.calls.push({method,input});if(fixture.delay)await new Promise(r=>setTimeout(r,fixture.delay));const code=fixture.failNext;fixture.failNext='';return code?failure(code):null;}
export async function listLeads(input:unknown){const failed=await call('list',input);return failed??ok([...fixture.rows]);}
const receipts=new Map<string,{id:string;revision:number}>();
export async function createLead(input:CreateLeadInput){const failed=await call('create',input);if(failed)return failed;const saved=receipts.get(input.requestId);if(saved)return ok({kind:'saved' as const,saved});if(!input.allowDuplicate)return ok({kind:'duplicate' as const,duplicateCount:1});const next=row(fixture.rows.length+1,input as LeadFields);fixture.rows.push(next);receipts.set(input.requestId,{id:next.id,revision:1});return ok({kind:'saved' as const,saved:{id:next.id,revision:1}});}
export async function updateLead(input:UpdateLeadInput){const failed=await call('update',input);if(failed)return failed;fixture.rows=fixture.rows.map(r=>r.id===input.id?{...r,...input.fields,revision:r.revision+1}:r);return ok({id:input.id,revision:2});}
export async function setLeadStatus(input:SetLeadStatusInput){const failed=await call('status',input);if(failed)return failed;fixture.rows=fixture.rows.map(r=>r.id===input.id?{...r,status:input.status,revision:r.revision+1}:r);return ok({id:input.id,revision:2});}
export async function setLeadArchived(input:SetLeadArchivedInput){const failed=await call('archive',input);if(failed)return failed;fixture.rows=fixture.rows.map(r=>r.id===input.id?{...r,archivedAt:input.archived?'2026-11-26T08:00:00Z':null,revision:r.revision+1}:r);return ok({id:input.id,revision:2});}
export async function deleteLead(input:{id:string;expectedRevision:number}){const failed=await call('delete',input);if(failed)return failed;fixture.rows=fixture.rows.filter(r=>r.id!==input.id);return ok({id:input.id,revision:2});}
export async function getLead(input:{id:string}){return ok(fixture.rows.find(r=>r.id===input.id) as LeadRow);}
