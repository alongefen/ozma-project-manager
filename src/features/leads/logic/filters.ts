import type { LeadRow, LeadFilters } from '@/types/contracts/leads';
import { canonicalPhone } from './phone';
export function leadIsDue(row: Pick<LeadRow,'status'|'followUpDate'>, today:string): boolean {
 return row.followUpDate !== null && row.followUpDate <= today && !['won','irrelevant','denies_inquiry'].includes(row.status);
}
/** Also exported for the shared UI model: counts must use this exact filtered population. */
export function filterLeads(rows: LeadRow[], filters: LeadFilters, today: string): LeadRow[] {
 const search=filters.search.toLocaleLowerCase('he');
 const phoneSearch=canonicalPhone(search);
 return rows.filter(row =>
  (filters.archive==='all' || (filters.archive==='archived')===(row.archivedAt!==null)) &&
  (!filters.marketingCompany || row.marketingCompany===filters.marketingCompany) &&
  (!filters.statuses.length || filters.statuses.includes(row.status)) &&
  (!filters.dueOnly || leadIsDue(row,today)) &&
  (!search || [row.name,row.companyName ?? '',row.phone].some(v=>v.toLocaleLowerCase('he').includes(search)) || (phoneSearch.length>0 && row.canonicalPhone.includes(phoneSearch)))
 );
}
