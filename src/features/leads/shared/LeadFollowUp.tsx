import { Badge } from '@/components/ui';
import { leadIsDue } from '../logic/filters';
import { format } from '@/lib/format';
import type { LeadRow } from '@/types/contracts/leads';
export function LeadFollowUp({row,today}:{row:LeadRow;today:string}){return <span>{row.followUpDate?format.date(row.followUpDate):'ללא מועד מעקב'}{leadIsDue(row,today)&&<> · <Badge>{row.followUpDate!<today?'באיחור':'למעקב היום'}</Badge></>}</span>;}
