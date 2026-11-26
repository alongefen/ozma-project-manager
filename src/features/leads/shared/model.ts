import { LeadFiltersSchema, leadStatuses, type LeadRow, type LeadFilters, type LeadFields } from '@/types/contracts/leads';
import { filterLeads, leadIsDue } from '../logic/filters';
export const emptyFilters = (): LeadFilters => LeadFiltersSchema.parse({});
export const newFields = (today: string): LeadFields => ({ name: '', phone: '', email: null, companyName: null, businessType: null, projectBudget: null, hasDesigner: 'unknown', hasPlanSet: 'unknown', source: 'manual', marketingCompany: null, inquiryDate: today, status: 'new', followUpDate: null, notes: null });
export function leadsModel(rows: LeadRow[], filters: LeadFilters, today: string) {
  const filtered = filterLeads(rows, LeadFiltersSchema.parse(filters), today).sort((a,b) => b.inquiryDate.localeCompare(a.inquiryDate) || b.id.localeCompare(a.id));
  const total = filtered.length;
  return { rows: filtered, total, due: filtered.filter(r=>leadIsDue(r,today)).length, won: filtered.filter(r=>r.status==='won').length,
    statuses: leadStatuses.map(status=>{ const count=filtered.filter(r=>r.status===status).length; return {status,count,percent:total ? Math.round(count/total*100) : 0}; }) };
}
export function errorText(code: string) {
  switch(code) {
    case 'CONFLICT': return 'הליד השתנה. הנתונים רועננו; פתחו שוב ונסו מחדש.';
    case 'VALIDATION': return 'יש לבדוק את השדות ולנסות שוב.';
    case 'NOT_FOUND': return 'הליד אינו זמין עוד או שהגישה סגורה.';
    case 'FORBIDDEN': case 'UNAUTHENTICATED': return 'אין הרשאה לפעולה. יש להיכנס מחדש.';
    default: return 'הפעולה לא הושלמה. אפשר לנסות שוב.';
  }
}
export function fieldsFromForm(form: FormData) {
  const keys=['name','phone','email','companyName','businessType','projectBudget','hasDesigner','hasPlanSet','source','marketingCompany','inquiryDate','status','followUpDate','notes'];
  return Object.fromEntries(keys.map(key=>{const value=String(form.get(key)??'').trim();return [key,value || (['name','phone','inquiryDate'].includes(key)?'':null)];}));
}
