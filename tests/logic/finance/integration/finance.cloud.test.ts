import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Platform, RequestContext, Saved } from '@/types/contracts';
vi.mock('server-only',()=>({}));
import { createFinanceApi } from '@/features/finance/logic';
import { rpc, fetchAll } from '@/lib/db/rpc';
import { permissions } from '@/lib/permissions';
import { format } from '@/lib/format';
import { cloudActor, cloudOwner } from '../../../auth/support/cloud';

const api=createFinanceApi({rpc,fetchAll,permissions,format} as Platform);
let ben:RequestContext, manager:RequestContext, worker:RequestContext, projectId:string, otherId:string;
const fields={year:2026,month:12,day:2,kind:'income' as const,amount:100050,details:'כספים בדויים'};
async function saved(result:Awaited<ReturnType<typeof api.createTransaction>>):Promise<Saved>{
  expect(result.ok).toBe(true);if(!result.ok)throw new Error('פעולת בדיקה נכשלה');return result.value;
}
beforeAll(async()=>{
  ben=await cloudOwner(); manager=(await cloudActor(ben,'finance-manager')).ctx;worker=(await cloudActor(ben,'finance-worker')).ctx;
  for(const label of ['finance','other']) {
    const result=await rpc<unknown,Saved>(ben,'create_project',{requestId:randomUUID(),fields:{name:`P146 ${label} ${randomUUID()}`,businessName:'בדוי',siteAddress:'בדיקה',contact:{name:'בדוי',phone:'0',email:null,roleTitle:null},startDate:null,endDate:null,accessNotes:null}});
    if(!result.ok)throw new Error('יצירת פרויקט בדוי נכשלה');
    if(label==='finance')projectId=result.value.id;else otherId=result.value.id;
  }
  for(const [ctx,role] of [[manager,'manager'],[worker,'worker']] as const){
    expect(await rpc(ben,'set_membership',{userId:ctx.actor.userId,projectId,role,expectedRevision:null})).toMatchObject({ok:true});
  }
},120000);

describe.sequential('FinanceApi מול ענן הפיתוח המאושר',()=>{
  it('בעלים יוצר, retry אינו מכפיל, מנהל בלי כספים ועובד חסומים',async()=>{
    const input={requestId:randomUUID(),projectId,fields};
    const first=await saved(await api.createTransaction(ben,input));
    expect(await api.createTransaction(ben,input)).toEqual({ok:true,value:first});
    for(const ctx of [manager,worker]){
      expect(await api.getBook(ctx,{projectId,filter:{period:'all'}})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});
      expect(await api.createTransaction(ctx,{...input,requestId:randomUUID()})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});
    }
  });
  it('גישה לכספים בפרויקט אחד, יתרות מלאות, החזר וזיכוי ומסנני שורות',async()=>{
    expect(await rpc(ben,'set_finance_access',{userId:manager.actor.userId,projectId,enabled:true,expectedRevision:1})).toMatchObject({ok:true});
    await saved(await api.createTransaction(manager,{requestId:randomUUID(),projectId,fields:{...fields,year:2027,month:2,kind:'income_refund',amount:1000}}));
    await saved(await api.createTransaction(manager,{requestId:randomUUID(),projectId,fields:{...fields,kind:'expense_credit',amount:200,day:3}}));
    expect(await api.getBook(manager,{projectId:otherId,filter:{period:'all'}})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});
    const empty=await api.getBook(manager,{projectId,filter:{period:{year:2027,month:1}}});
    expect(empty).toMatchObject({ok:true,value:{period:{income:0,tax:0,balance:97248}}});
    const filtered=await api.getBook(manager,{projectId,filter:{period:{year:2026,month:12},day:2,search:'כספים'}});
    expect(filtered).toMatchObject({ok:true,value:{period:{income:100050,expense:-200,tax:3002,netProfit:97248},filteredRows:{income:100050,expense:0}}});
    expect(await api.getBook(manager,{projectId,filter:{period:{year:2027,month:2}}})).toMatchObject({ok:true,value:{period:{income:-1000,tax:-30,netProfit:-970,profitPercentTenths:null,balance:96278}}});
  });
  it('revision, ביטול רק לבעלים וקישור Excel',async()=>{
    const transaction=await saved(await api.createTransaction(manager,{requestId:randomUUID(),projectId,fields:{...fields,amount:50}}));
    expect(await api.updateTransaction(manager,{id:transaction.id,expectedRevision:99,fields})).toMatchObject({ok:false,error:{code:'CONFLICT'}});
    expect(await api.cancelTransaction(manager,{id:transaction.id,expectedRevision:transaction.revision})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
    await saved(await api.cancelTransaction(ben,{id:transaction.id,expectedRevision:transaction.revision}));
    expect(await api.listCancelled(ben,{projectId})).toMatchObject({ok:true,value:expect.arrayContaining([expect.objectContaining({id:transaction.id})])});
    expect(await api.listCancelled(manager,{projectId})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
    await saved(await api.setExcelLink(manager,{projectId,url:'https://example.invalid/p146',expectedRevision:1}));
    expect(await api.setExcelLink(manager,{projectId,url:null,expectedRevision:1})).toMatchObject({ok:false,error:{code:'CONFLICT'}});
  });
  it('סיכום כל הפרויקטים זמין רק לבעלים',async()=>{
    expect(await api.getAllProjectTotals(manager,{})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
    const result=await api.getAllProjectTotals(ben,{from:{year:2027,month:1},to:{year:2027,month:1}});
    expect(result.ok).toBe(true);
    if(result.ok)expect(result.value.filter(p=>p.projectId===projectId)).toEqual([expect.objectContaining({projectId,month:expect.objectContaining({income:0,tax:0,balance:97248})})]);
  });
  it('פרויקט שהסתיים קריא למנהל עם כספים אך הכתיבה נשארת לבעלים',async()=>{
    expect(await rpc(ben,'set_project_status',{id:projectId,expectedRevision:1,status:'completed'})).toMatchObject({ok:true});
    expect(await api.getBook(manager,{projectId,filter:{period:'all'}})).toMatchObject({ok:true,value:{canWrite:false}});
    expect(await api.createTransaction(manager,{requestId:randomUUID(),projectId,fields})).toMatchObject({ok:false,error:{code:'PROJECT_READ_ONLY'}});
    await saved(await api.createTransaction(ben,{requestId:randomUUID(),projectId,fields:{...fields,amount:1}}));
  });
  it('שלילת התפקיד משפיעה מיד גם על הקשר קיים',async()=>{
    expect(await rpc(ben,'set_membership',{userId:manager.actor.userId,projectId,role:'worker',expectedRevision:2})).toMatchObject({ok:true});
    expect(await api.getBook(manager,{projectId,filter:{period:'all'}})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});
    expect(await api.createTransaction(manager,{requestId:randomUUID(),projectId,fields})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});
  });
});
