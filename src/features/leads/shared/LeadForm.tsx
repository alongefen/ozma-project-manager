'use client';
import { useId, useRef, useState, type ReactNode, type DialogHTMLAttributes } from 'react';
import { ConfirmDialog, DateField, FormActions, Notice, SelectField, Sheet, TextField } from '@/components/ui';
import { LeadFieldsSchema, leadMarketingCompanies, leadMarketingCompanyLabels, leadSources, leadSourceLabels, leadStatuses, leadStatusLabels, leadTriStateLabels, type LeadFields, type LeadRow } from '@/types/contracts/leads';
import * as actions from '../logic/actions';
import { errorText, fieldsFromForm, newFields } from './model';
import css from './Leads.module.css';

// Contain close events from the nested duplicate dialog before they reach the editor.
const nestedDialogEvents: Pick<DialogHTMLAttributes<HTMLDivElement>, 'onClose'> = { onClose: event => event.stopPropagation() };
type Props={row:LeadRow|null;today:string;onSaved:()=>void;onClose:()=>void; extraActions?:ReactNode; locked:boolean;onBusy:(busy:boolean)=>void;onConflict:()=>void};
export function LeadForm({row,today,onSaved,onClose,onBusy,onConflict,extraActions,locked}:Props) {
 const [fields] = useState<LeadFields>(()=>row??newFields(today));
 const requestId=useRef<string|null>(null);
 const inFlight=useRef(false);
 const pending=useRef<LeadFields|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const [errors,setErrors]=useState<Record<string,string>>({});
 const [duplicates,setDuplicates]=useState(0);
 const [uncertain,setUncertain]=useState(false);
 const formId=useId();
 const mark=(value:boolean)=>{inFlight.current=value;setBusy(value);onBusy(value);};
 async function save(values:LeadFields,allowDuplicate=false) {
  if(inFlight.current)return;
  requestId.current??=crypto.randomUUID();
  pending.current=values;mark(true);setError(null);
  try {
   const result=row?await actions.updateLead({id:row.id,expectedRevision:row.revision,fields:values}):await actions.createLead({...values,requestId:requestId.current,allowDuplicate});
   if(!result.ok){setError(errorText(result.error.code));setUncertain(result.error.code==='UNAVAILABLE');if(result.error.code==='CONFLICT')onConflict();return;}
   setUncertain(false);
   if('kind' in result.value && result.value.kind==='duplicate'){setDuplicates(result.value.duplicateCount);return;}
   onSaved();
  }catch{setError(errorText('UNAVAILABLE'));setUncertain(true);}finally{mark(false);}
 }
 const options=(labels:Record<string,string>)=>Object.entries(labels).map(([value,label])=>({value,label}));
 const fieldError=(name:string)=>errors[name];
 return <Sheet open title={row?'פרטי ליד':'ליד חדש'} dismissible={!locked} onClose={onClose} onEscape={onClose}
 footer={<FormActions placement="sheet" form={formId} hideCancel spread busy={locked} submitLabel={busy?'שומר…':uncertain?'ניסיון נוסף':'שמירה'} extra={extraActions}/>}
 ><div {...nestedDialogEvents} onKeyDown={event=>{
  if(event.key!=='Escape')return;
  const target=event.target as HTMLElement;
  if(target.closest('dialog')!==event.currentTarget.closest('dialog')||event.currentTarget.querySelector(':popover-open'))return;
  event.preventDefault();event.stopPropagation();if(!locked)onClose();
 }}><form id={formId} className={css.form} noValidate onSubmit={e=>{e.preventDefault();if(uncertain&&pending.current){void save(pending.current,duplicates>0);return;}const parsed=LeadFieldsSchema.safeParse(fieldsFromForm(new FormData(e.currentTarget)));if(!parsed.success){setErrors(Object.fromEntries(parsed.error.issues.map(i=>[String(i.path[0]),'יש למלא ערך תקין.'])));return;}setErrors({});void save(parsed.data);}}>
 <fieldset disabled={busy||uncertain} className={css.fields}>
 <TextField label="שם" name="name" required maxLength={200} defaultValue={fields.name} error={fieldError('name')}/>
 <TextField label="טלפון" name="phone" type="tel" ltr required maxLength={80} defaultValue={fields.phone} error={fieldError('phone')}/>
 <TextField label="אימייל" name="email" type="email" ltr maxLength={254} defaultValue={fields.email??''} error={fieldError('email')}/>
 <TextField label="שם חברה" name="companyName" maxLength={200} defaultValue={fields.companyName??''}/>
 <TextField label="סוג עסק" name="businessType" maxLength={200} defaultValue={fields.businessType??''}/>
 <TextField label="תקציב הפרויקט" name="projectBudget" maxLength={500} defaultValue={fields.projectBudget??''}/>
 <SelectField label="יש מעצב" name="hasDesigner" defaultValue={fields.hasDesigner} options={options(leadTriStateLabels)}/>
 <SelectField label="יש סט תוכניות" name="hasPlanSet" defaultValue={fields.hasPlanSet} options={options(leadTriStateLabels)}/>
 <SelectField label="מקור הפנייה" name="source" defaultValue={fields.source} options={leadSources.map(value=>({value,label:leadSourceLabels[value]}))}/>
 <SelectField label="חברת שיווק" name="marketingCompany" defaultValue={fields.marketingCompany??''} options={[{value:'',label:'ללא בחירה'},...leadMarketingCompanies.map(value=>({value,label:leadMarketingCompanyLabels[value]}))]}/>
 <DateField label="תאריך פנייה" name="inquiryDate" required defaultValue={fields.inquiryDate} error={fieldError('inquiryDate')}/>
 <SelectField label="סטטוס" name="status" defaultValue={fields.status} options={leadStatuses.map(value=>({value,label:leadStatusLabels[value]}))}/>
 <DateField label="תאריך מעקב" name="followUpDate" defaultValue={fields.followUpDate??''} error={fieldError('followUpDate')}/>
 <label className={css.notes}>סיכום שיחה / הערות<textarea className="ui-field__input" name="notes" maxLength={10000} defaultValue={fields.notes??''}/></label>
 </fieldset>
 {error&&<Notice tone="error">{error}</Notice>}
 {uncertain&&<Notice>התשובה לא התקבלה. ניסיון נוסף ישלח את אותם פרטים בבטחה.</Notice>}
 </form>
 <ConfirmDialog open={duplicates>0} title="ייתכן שהליד כבר קיים" confirmLabel="יצירה בכל זאת" busy={busy} error={error} onConfirm={()=>{if(pending.current)void save(pending.current,true);}} onCancel={()=>{setDuplicates(0);setError(null);}}><p>נמצאו {duplicates} לידים עם אותו טלפון, כולל בארכיון. הפרטים שהזנת נשמרו.</p></ConfirmDialog>
 </div></Sheet>;
}
