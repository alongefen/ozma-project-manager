'use client';
import { Badge, Button } from '@/components/ui';
import { leadSourceLabels } from '@/types/contracts/leads';
import { useLeads } from '../shared/LeadsProvider';
import { LeadStatusField } from '../shared/LeadStatusField';
import { LeadFollowUp } from '../shared/LeadFollowUp';
import css from '../shared/Leads.module.css';
export function LeadsDesktop(){const {rows,today,busy,open}=useLeads();return <div className="d-only"><table className={css.table}><caption className="sr-only">רשימת לידים</caption><thead><tr>{['ליד / חברה','טלפון','סטטוס','מעקב','מקור','פתיחה'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><strong>{row.name}</strong><div className={css.context}>{[row.companyName,row.businessType].filter(Boolean).join(' · ')}</div>{row.archivedAt&&<Badge tone="gray">בארכיון</Badge>}</td><td><span className="ltr">{row.phone}</span></td><td><LeadStatusField row={row}/></td><td><LeadFollowUp row={row} today={today}/></td><td>{leadSourceLabels[row.source]}</td><td><Button variant="secondary" disabled={busy} onClick={()=>open(row)} aria-label={`פתיחת ליד: ${row.name}`}>פתיחה</Button></td></tr>)}</tbody></table></div>;}
