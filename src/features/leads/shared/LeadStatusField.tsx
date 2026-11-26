'use client';
import { SelectField } from '@/components/ui';
import { leadStatuses, leadStatusLabels, type LeadRow, type LeadStatus } from '@/types/contracts/leads';
import { useLeads } from './LeadsProvider';
export function LeadStatusField({row}:{row:LeadRow}){const {busy,setStatus}=useLeads();return <SelectField aria-label={`סטטוס: ${row.name}`} disabled={busy} value={row.status} onChange={value=>setStatus(row,value as LeadStatus)} options={leadStatuses.map(value=>({value,label:leadStatusLabels[value]}))}/>;}
