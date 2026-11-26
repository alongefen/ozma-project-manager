'use client';
import { useRef, useState } from 'react';
import { ConfirmDialog, DateField, FormActions, Notice, SelectField, TextField } from '@/components/ui';
import { LeadFieldsSchema, leadMarketingCompanies, leadMarketingCompanyLabels, leadSources, leadSourceLabels, leadStatuses, leadStatusLabels, leadTriStateLabels, type LeadFields, type LeadRow } from '@/types/contracts/leads';
import * as actions from '../logic/actions';
import { errorText, fieldsFromForm, newFields } from './model';
import css from './Leads.module.css';

type Props={row:LeadRow|null;today:string;onSaved:()=>void;onCancel:()=>void;onBusy:(busy:boolean)=>void;onConflict:()=>void};
export function LeadForm({row,today,onSaved,onCancel,onBusy,onConflict}:Props) {
 const [fields] = useState<LeadFields>(()=>row??newFields(today));
 const requestId=useRef<string|null>(null);
 const inFlight=useRef(false);
 const pending=useRef<LeadFields|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const [errors,setErrors]=useState<Record<string,string>>({});
 const [duplicates,setDuplicates]=useState(0);
 const [uncertain,setUncertain]=useState(false);
 const [cancel,setCancel]=useState(false);
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
 return <><form className={css.form} noValidate onSubmit={e=>{e.preventDefault();if(uncertain&&pending.current){void save(pending.current,duplicates>0);return;}const parsed=LeadFieldsSchema.safeParse(fieldsFromForm(new FormData(e.currentTarget)));if(!parsed.success){setErrors(Object.fromEntries(parsed.error.issues.map(i=>[String(i.path[0]),'יש למלא ערך תקין.'])));return;}setErrors({});void save(parsed.data);}}>
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
 <FormActions placement="sheet" busy={busy} submitLabel={busy?'שומר…':uncertain?'ניסיון נוסף':'שמירה'} onCancel={()=>{if(!inFlight.current)setCancel(true);}}/>
 </form>
 <ConfirmDialog open={duplicates>0} title="ייתכן שהליד כבר קיים" confirmLabel="יצירה בכל זאת" busy={busy} error={error} onConfirm={()=>{if(pending.current)void save(pending.current,true);}} onCancel={()=>{setDuplicates(0);setError(null);}}><p>נמצאו {duplicates} לידים עם אותו טלפון, כולל בארכיון. הפרטים שהזנת נשמרו.</p></ConfirmDialog>
 <ConfirmDialog open={cancel} title="ביטול עריכת ליד" confirmLabel="ביטול העריכה" onConfirm={onCancel} onCancel={()=>setCancel(false)}><p>השינויים בטופס לא יישמרו. שום ליד קיים לא נמחק.</p></ConfirmDialog>
 </>;
}
