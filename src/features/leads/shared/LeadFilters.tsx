'use client';
import { useState } from 'react';
import { FilterPopup, MultiSelectField, SelectField, TextField } from '@/components/ui';
import { LeadFiltersSchema, leadMarketingCompanies, leadMarketingCompanyLabels, leadStatuses, leadStatusLabels, type LeadFilters as Filters, type LeadStatus } from '@/types/contracts/leads';
import { emptyFilters } from './model';
import css from './Leads.module.css';
export function LeadFilters({ filters, setFilters }: { filters: Filters; setFilters: (f: Filters)=>void }) {
 const count=Number(!!filters.search)+Number(!!filters.marketingCompany)+Number(!!filters.statuses.length)+Number(filters.dueOnly)+Number(filters.archive!=='active');
 return <><div className={css.search}><TextField label="חיפוש לידים" hideLabel placeholder="שם, טלפון או חברה" type="search" maxLength={200} value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})}/></div><FilterPopup count={count} onClear={()=>setFilters(emptyFilters())} onApply={data=>{setFilters(LeadFiltersSchema.parse({search:filters.search,marketingCompany:data.get('marketingCompany')||undefined,statuses:String(data.get('statuses')??'').split(',').filter(Boolean),dueOnly:data.get('due')==='yes',archive:data.get('archive')}));}}>
 <SelectField name="marketingCompany" label="חברת שיווק" defaultValue={filters.marketingCompany??''} options={[{value:'',label:'כל החברות'},...leadMarketingCompanies.map(value=>({value,label:leadMarketingCompanyLabels[value]}))]} />
 <StatusFilter initial={filters.statuses}/>
 <SelectField name="due" label="מועד מעקב" defaultValue={filters.dueOnly?'yes':''} options={[{value:'',label:'כל המועדים'},{value:'yes',label:'היום ובאיחור'}]} />
 <SelectField name="archive" label="ארכיון" defaultValue={filters.archive} options={[{value:'active',label:'פעילים'},{value:'archived',label:'בארכיון'},{value:'all',label:'הכול'}]} />
 </FilterPopup></>;
}

function StatusFilter({initial}:{initial:LeadStatus[]}) {
 const [selected,setSelected]=useState<string[]>(initial);
 return <><MultiSelectField label="סטטוסים" placeholder="כל הסטטוסים" value={selected} onChange={setSelected} options={leadStatuses.map(value=>({value,label:leadStatusLabels[value]}))}/><input type="hidden" name="statuses" value={selected.join(',')}/></>;
}
