'use client';
import { Badge, Button, Card } from '@/components/ui';
import { leadSourceLabels } from '@/types/contracts/leads';
import { useLeads } from '../shared/LeadsProvider';
import { LeadStatusField } from '../shared/LeadStatusField';
import { LeadFollowUp } from '../shared/LeadFollowUp';
import css from '../shared/Leads.module.css';
export function LeadsMobile(){const {rows,today,busy,open}=useLeads();return <div className={`m-only ${css.cards}`}>{rows.map(row=><Card key={row.id}><div className={css.card}><div className={css.cardHead}><div><strong>{row.name}</strong><div className={css.context}>{[row.companyName,row.businessType].filter(Boolean).join(' · ')}</div><span className={`ltr ${css.phone}`}>{row.phone}</span></div><Button variant="secondary" disabled={busy} onClick={()=>open(row)} aria-label={`פתיחת ליד: ${row.name}`}>פתיחה</Button></div><LeadStatusField row={row}/><LeadFollowUp row={row} today={today}/><span>{leadSourceLabels[row.source]} {row.archivedAt&&<Badge tone="gray">בארכיון</Badge>}</span></div></Card>)}</div>;}
