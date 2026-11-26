'use client';
import { createContext, useContext, useRef, useState, type DialogHTMLAttributes } from 'react';
import { Button, ConfirmDialog, Notice, Pin, Sheet, StateMessage } from '@/components/ui';
import type { LeadFilters as Filters, LeadRow, LeadStatus } from '@/types/contracts/leads';
import * as actions from '../logic/actions';
import { emptyFilters, errorText, leadsModel } from './model';
import { LeadForm } from './LeadForm';
import { LeadFilters } from './LeadFilters';
import { LeadSummary } from './LeadSummary';
import { LeadsMobile } from '../mobile/LeadsMobile';
import { LeadsDesktop } from '../desktop/LeadsDesktop';
import css from './Leads.module.css';
type Context={rows:LeadRow[];today:string;busy:boolean;setStatus:(row:LeadRow,status:LeadStatus)=>void;open:(row:LeadRow)=>void};
const LeadsContext=createContext<Context|null>(null);
export function useLeads(){const value=useContext(LeadsContext);if(!value)throw new Error('LeadsProvider missing');return value;}
// React close events bubble from nested dialogs; contain them before the edit Sheet.
const nestedDialogEvents: Pick<DialogHTMLAttributes<HTMLDivElement>, 'onClose'> = { onClose: event => event.stopPropagation() };
type Confirmation={row:LeadRow;kind:'archive'|'restore'|'delete'};
export function LeadsProvider({initial,today}:{initial:LeadRow[];today:string}) {
 const [rows,setRows]=useState(initial);
 const [filters,setFilters]=useState<Filters>(emptyFilters);
 const [error,setError]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 // A synchronous lock also rejects a second event before React's disabled render.
 const lock=useRef(false);
 const generation=useRef(0);
 const reads=useRef(0);
 const [closing,setClosing]=useState(false);
 const [form,setForm]=useState<{row:LeadRow|null}|null>(null);
 const [confirm,setConfirm]=useState<Confirmation|null>(null);
 const [confirmError,setConfirmError]=useState<string|null>(null);
 const mark=(value:boolean)=>{lock.current=value;if(value)generation.current++;setBusy(value);};
 const model=leadsModel(rows,filters,today);
 async function reload(){
  const version=generation.current;const read=++reads.current;
  try{const result=await actions.listLeads({archive:'all'});if(version!==generation.current||read!==reads.current)return false;if(result.ok){setRows(result.value);return true;}setError(errorText(result.error.code));}catch{if(version===generation.current&&read===reads.current)setError(errorText('UNAVAILABLE'));}return false;
 }
 async function setStatus(row:LeadRow,status:LeadStatus){
  if(lock.current||form||status===row.status)return;
  mark(true);setError(null);setRows(current=>current.map(r=>r.id===row.id?{...r,status}:r));
  try{
   const result=await actions.setLeadStatus({id:row.id,expectedRevision:row.revision,status});
   if(result.ok){setRows(current=>current.map(r=>r.id===row.id?{...r,status,revision:result.value.revision}:r));await reload();}
   else{setRows(current=>current.map(r=>r.id===row.id?row:r));setError(errorText(result.error.code));if(result.error.code==='CONFLICT'||result.error.code==='UNAVAILABLE')await reload();}
  }catch{setRows(current=>current.map(r=>r.id===row.id?row:r));setError(errorText('UNAVAILABLE'));await reload();}finally{mark(false);}
 }
 async function mutate(){
  if(!confirm||lock.current)return;
  const {row,kind}=confirm;mark(true);setConfirmError(null);
  try{
   const input={id:row.id,expectedRevision:row.revision};
   const result=kind==='delete'?await actions.deleteLead(input):await actions.setLeadArchived({...input,archived:kind==='archive'});
   if(!result.ok){if(result.error.code==='CONFLICT'){setConfirm(null);setForm(null);setError(errorText(result.error.code));await reload();}else setConfirmError(errorText(result.error.code));return;}
   setRows(current=>kind==='delete'?current.filter(r=>r.id!==row.id):current.map(r=>r.id===row.id?{...r,revision:result.value.revision,archivedAt:kind==='archive'?new Date().toISOString():null}:r));
   setConfirm(null);setForm(null);await reload();
  }catch{setConfirmError(errorText('UNAVAILABLE'));}finally{mark(false);}
 }
 function ask(kind:Confirmation['kind']){if(form?.row&&!lock.current){setConfirmError(null);setConfirm({row:form.row,kind});}}
 return <LeadsContext.Provider value={{rows:model.rows,today,busy,setStatus,open:row=>{if(!lock.current)setForm({row});}}}><div className={css.root}>
 <Pin><div className={css.toolbar}><Button icon="add" className="ui-lead" disabled={busy} onClick={()=>{if(!lock.current)setForm({row:null});}}>ליד חדש</Button><LeadFilters filters={filters} setFilters={setFilters}/></div></Pin>
 {error&&<Notice tone="error">{error}</Notice>}
 <LeadSummary model={model}/>
 {!model.total?<StateMessage backHref="/projects" backLabel="חזרה לפרויקטים">{rows.length?'לא נמצאו לידים התואמים לסינון.':'עדיין אין לידים.'}</StateMessage>:<><LeadsMobile/><LeadsDesktop/></>}
 <Sheet open={!!form} title={form?.row?'פרטי ליד':'ליד חדש'} dismissible={!busy} onClose={()=>{if(form&&!lock.current)setClosing(true);}}>
 {form&&<div {...nestedDialogEvents} onKeyDown={event=>{
  // Ask before cancelling without letting Escape close the controlled editor first.
  // Nested confirmations and open shared pickers retain their own Escape behaviour.
  if(event.key!=='Escape')return;
  const target=event.target as HTMLElement;
  if(target.closest('dialog')!==event.currentTarget.closest('dialog')||event.currentTarget.querySelector(':popover-open'))return;
  event.preventDefault();event.stopPropagation();if(!lock.current)setClosing(true);
 }}><LeadForm row={form.row} today={today} onBusy={mark} onCancel={()=>setForm(null)} onConflict={()=>{setForm(null);setError(errorText('CONFLICT'));void reload();}} onSaved={()=>{setForm(null);void reload();}}/>
 {form.row&&<div className={css.actions}><Button variant="secondary" disabled={busy} onClick={()=>ask(form.row?.archivedAt?'restore':'archive')}>{form.row.archivedAt?'החזרה מהארכיון':'העברה לארכיון'}</Button><Button variant="secondary" disabled={busy} onClick={()=>ask('delete')}>מחיקת ליד</Button></div>}</div>}
 </Sheet>
 <ConfirmDialog open={closing} title="ביטול עריכת ליד" confirmLabel="ביטול העריכה" onConfirm={()=>{setClosing(false);setForm(null);}} onCancel={()=>setClosing(false)}><p>השינויים בטופס לא יישמרו. שום ליד קיים לא נמחק.</p></ConfirmDialog>
 <ConfirmDialog open={!!confirm} title={confirm?.kind==='delete'?'מחיקת ליד':confirm?.kind==='restore'?'החזרה מהארכיון':'העברה לארכיון'} confirmLabel={confirm?.kind==='delete'?'מחיקה':confirm?.kind==='restore'?'החזרה':'העברה לארכיון'} danger busy={busy} error={confirmError} onConfirm={()=>void mutate()} onCancel={()=>setConfirm(null)}><p>{confirm?.row.name}: {confirm?.kind==='delete'?'הליד יוסר מהרשימות; הרשומה והפרטים נשמרים במסד. אין שחזור מהמסך הזה.':'שום דבר לא נמחק. ניתן להחזיר את הליד מהארכיון.'}</p></ConfirmDialog>
 </div></LeadsContext.Provider>;
}
