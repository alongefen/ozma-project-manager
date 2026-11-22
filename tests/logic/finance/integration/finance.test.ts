import { describe, expect, it, vi } from 'vitest';
import type { Db, Platform, RequestContext } from '@/types/contracts';
vi.mock('server-only', () => ({}));
import { createFinanceApi } from '@/features/finance/logic';
import { format } from '@/lib/format';
import { fetchAll } from '@/lib/db/rpc';

const projectId='11111111-1111-4111-8111-111111111111';
const id='22222222-2222-4222-8222-222222222222';
const field={year:2026,month:12,day:2,kind:'income' as const,amount:10000,details:'תשלום בדוי'};
const row={...field,id,position:1,cancelled_at:null,revision:1};
function fixture(options: { view?:boolean; write?:boolean; owner?:boolean; raw?:unknown[]; rows?:unknown[] }={}) {
  const ranges:unknown[][]=[];
  const from=vi.fn((table:string)=>{
    let start=0,end=999;
    const data=table==='projects'?{id:projectId,name:'פרויקט בדוי'}:table==='project_finance_settings'?{excel_url:null,revision:1}:options.rows??[row];
    const query={select:vi.fn(()=>query),eq:vi.fn(()=>query),is:vi.fn(()=>query),not:vi.fn(()=>query),order:vi.fn(()=>query),
      single:vi.fn(async()=>({data,error:null})),
      range:vi.fn((a:number,b:number)=>{start=a;end=b;ranges.push([table,a,b]);return query;}),
      then(resolve:(v:unknown)=>unknown){return Promise.resolve({data:Array.isArray(data)?data.slice(start,end+1):data,error:null}).then(resolve);}};
    return query;
  });
  const ctx={db:{from} as unknown as Db,actor:{userId:id,isOwner:options.owner??true,email:'test@example.invalid',fullName:'בדוי'},today:'2027-02-01'} satisfies RequestContext;
  const rpc=vi.fn(async(_ctx:RequestContext,name:string)=>({ok:true,value:name==='finance_month_totals'?options.raw??[{year:2026,month:12,income:10000,expense:0}]:name==='diary_summary'?{workDays:3,reportCount:4,byProject:[]}:name==='finance_all_month_totals'?[]:{id,revision:2}}));
  const forProject=vi.fn(async()=>({ok:true,value:{view:true,viewFinance:options.view??true,writeFinance:options.write??true,cancelTransaction:options.owner??true}}));
  const requireOwner=vi.fn(async()=>options.owner===false?{ok:false,error:{code:'FORBIDDEN',message:'אסור'}}:{ok:true,value:null});
  const platform={rpc,fetchAll,format,permissions:{forProject,requireOwner}} as unknown as Platform;
  return {api:createFinanceApi(platform),ctx,rpc,from,forProject,requireOwner,ranges};
}

describe('חיבור ספר הכספים',()=>{
  it('סיכומי נטו, חודש ריק ומעבר שנה נשמרים לפני בחירת חודש',async()=>{
    const f=fixture({raw:[{year:2026,month:12,income:10000,expense:2000},{year:2027,month:2,income:-1000,expense:-100}]});
    const result=await f.api.getBook(f.ctx,{projectId,filter:{period:{year:2027,month:1}}});
    expect(result).toMatchObject({ok:true,value:{projectId,period:{income:0,tax:0,netProfit:0,balance:7700,profitPercentTenths:null},workDays:3}});
    if(result.ok) expect(result.value.months).toHaveLength(1);
    expect(f.rpc).toHaveBeenCalledWith(f.ctx,'finance_month_totals',{projectId});
    expect(f.rpc).toHaveBeenCalledWith(f.ctx,'diary_summary',{projectId,from:'2027-01-01',to:'2027-01-31'});
  });
  it('חיפוש ויום מסננים שורות בלבד, כולל החזר וזיכוי',async()=>{
    const f=fixture({raw:[{year:2026,month:12,income:9000,expense:1800}],rows:[row,{...row,id:'33333333-3333-4333-8333-333333333333',kind:'income_refund',amount:1000,day:3,position:2},{...row,id:'44444444-4444-4444-8444-444444444444',kind:'expense_credit',amount:200,position:3}]});
    const r=await f.api.getBook(f.ctx,{projectId,filter:{period:'all',day:2,search:'תשלום'}});
    expect(r).toMatchObject({ok:true,value:{period:{income:9000,expense:1800,tax:270,netProfit:6930},filteredRows:{income:10000,expense:-200}}});
  });
  it.each([false,true])('תפקיד שנשלל ופרויקט ללא כספים נדחים (write %s)',async(write)=>{
    const f=fixture({view:false,write});
    expect(await f.api.getBook(f.ctx,{projectId,filter:{period:'all'}})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});
    expect(f.from).not.toHaveBeenCalled();
  });
  it('מצב קריאה של פרויקט שהסתיים נמסר לתצוגה',async()=>{
    const f=fixture({write:false,owner:false});
    expect(await f.api.getBook(f.ctx,{projectId,filter:{period:'all'}})).toMatchObject({ok:true,value:{canWrite:false,canCancel:false}});
  });
  it('רשימת ביטולים וכל הפרויקטים דורשות בעלים מחדש',async()=>{
    const f=fixture({owner:false});
    expect(await f.api.listCancelled(f.ctx,{projectId})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
    expect(await f.api.getAllProjectTotals(f.ctx,{})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
  });
  it('קורא את כל עמודי השורות ולא רק אלף ראשונות',async()=>{
    const f=fixture({rows:Array.from({length:1001},(_,n)=>({...row,id:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,position:n}))});
    const r=await f.api.getBook(f.ctx,{projectId,filter:{period:'all'}});
    expect(r.ok&&r.value.months[0].incomeRows).toHaveLength(1001);
    expect(f.ranges).toContainEqual(['transactions',1000,1999]);
  });
  it('סיכום פרויקטים מחשב כל היסטוריה לפני טווח ואינו מעגל מס משותף',async()=>{
    const f=fixture();
    f.rpc.mockResolvedValueOnce({ok:true,value:[
      {projectId,projectName:'א',year:2026,month:12,income:100050,expense:0},
      {projectId,projectName:'א',year:2027,month:2,income:17,expense:0},
      {projectId:id,projectName:'ב',year:2027,month:1,income:100050,expense:0},
    ]} as never);
    const r=await f.api.getAllProjectTotals(f.ctx,{from:{year:2027,month:1},to:{year:2027,month:1}});
    expect(r).toMatchObject({ok:true,value:expect.arrayContaining([
      {projectId,projectName:'א',month:expect.objectContaining({year:2027,month:1,tax:0,balance:97048})},
      {projectId:id,projectName:'ב',month:expect.objectContaining({tax:3002,balance:97048})},
    ])});
    expect(f.rpc).toHaveBeenCalledWith(f.ctx,'finance_all_month_totals',{});
  });
  it('כשל בקריאת סיכום אינו מחזיר ספר חלקי',async()=>{
    const f=fixture(); f.rpc.mockResolvedValueOnce({ok:false,error:{code:'UNAVAILABLE',message:'בדיקה'}} as never);
    expect(await f.api.getBook(f.ctx,{projectId,filter:{period:'all'}})).toMatchObject({ok:false,error:{code:'UNAVAILABLE'}});
  });
  it('טווח חודשים הפוך נדחה לפני גישה למסד',async()=>{
    const f=fixture();
    expect(await f.api.getAllProjectTotals(f.ctx,{from:{year:2027,month:2},to:{year:2026,month:1}})).toMatchObject({ok:false,error:{code:'VALIDATION'}});
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('קלט לא תקין נדחה לפני גישה למסד',async()=>{
    const f=fixture();
    expect(await f.api.getBook(f.ctx,{projectId:'invalid',filter:{period:'all'}})).toMatchObject({ok:false,error:{code:'VALIDATION'}});
    expect(f.rpc).not.toHaveBeenCalled();
  });
});

describe('פקודות כספים שומרות RPC והרשאות שרת',()=>{
  it('יצירה מעבירה requestId לשמירת idempotency',async()=>{
    const f=fixture();const input={requestId:id,projectId,fields:field};
    expect(await f.api.createTransaction(f.ctx,input)).toMatchObject({ok:true,value:{id,revision:2}});
    expect(f.rpc).toHaveBeenCalledWith(f.ctx,'create_transaction',input);
  });
  it('עדכון וביטול מעבירים revision, קישור מתורגם ל-RPC המאושר',async()=>{
    const f=fixture();
    await f.api.updateTransaction(f.ctx,{id,expectedRevision:1,fields:field});
    expect(f.rpc).toHaveBeenCalledWith(f.ctx,'update_transaction',{id,expectedRevision:1,fields:field});
    await f.api.cancelTransaction(f.ctx,{id,expectedRevision:1});
    expect(f.rpc).toHaveBeenCalledWith(f.ctx,'cancel_transaction',{id,expectedRevision:1});
    await f.api.setExcelLink(f.ctx,{projectId,url:'https://example.invalid/book',expectedRevision:1});
    expect(f.rpc).toHaveBeenCalledWith(f.ctx,'set_finance_link',{projectId,url:'https://example.invalid/book',expectedRevision:1});
  });
  it.each(['FORBIDDEN','PROJECT_READ_ONLY','CONFLICT','UNAUTHENTICATED'] as const)('שומר כשל %s מהמסד',async(code)=>{
    const f=fixture();f.rpc.mockResolvedValueOnce({ok:false,error:{code,message:'בדיקה'}} as never);
    expect(await f.api.createTransaction(f.ctx,{requestId:id,projectId,fields:field})).toMatchObject({ok:false,error:{code}});
  });
  it('סכום או יום לא חוקיים אינם מגיעים למסד',async()=>{
    const f=fixture();
    for(const fields of [{...field,amount:0},{...field,month:2,day:30}]) expect(await f.api.createTransaction(f.ctx,{requestId:id,projectId,fields})).toMatchObject({ok:false,error:{code:'VALIDATION'}});
    expect(f.rpc).not.toHaveBeenCalled();
  });
});
