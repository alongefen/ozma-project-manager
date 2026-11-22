import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Json } from '../../src/types/database';
import { actor, clients, membership, owner, project, readyFile, rpc, value, type Client, type TestActor } from './support/cloud';

type Saved = { id: string; revision: number };
let admin: Client, anonymous: Client, ben: TestActor, manager: TestActor, finance: TestActor, worker: TestActor, mixed: TestActor, outsider: TestActor;
let a: Saved, b: Saved;
const entryInput = (projectId: string, fileIds: string[] = []) => ({requestId:randomUUID(),projectId,workDate:'2026-01-01',body:'דיווח בדוי',fileIds});
const taskInput = (projectId: string) => ({requestId:randomUUID(),projectId,body:'פתק בדוי',dueDate:null,completed:false});
const fields = {year:2026,month:1,day:null,kind:'income',amount:10050,details:'תנועה בדויה'};
async function deny(client: Client, name: Parameters<typeof rpc>[1], input: Json, code?: string) {
  const result = await rpc(client,name,input);
  expect(result.error, `${name} should reject`).not.toBeNull();
  if(code) expect(result.error?.message).toBe(code);
}
async function rows(client: Client, table: 'projects'|'diary_entries'|'diary_versions'|'documents'|'transactions'|'sensitive_events'|'stored_files', column: string, id: string) {
  const result = await client.from(table).select('*').eq(column,id);
  expect(result.error).toBeNull(); return result.data ?? [];
}
async function transaction(client: Client, projectId: string) {
  return value<Saved>(client,'create_transaction',{requestId:randomUUID(),projectId,fields});
}

beforeAll(async () => {
  ({admin,anonymous}=clients()); ben=await owner(admin);
  manager=await actor(admin,ben.client,'manager'); finance=await actor(admin,ben.client,'finance');
  worker=await actor(admin,ben.client,'worker'); mixed=await actor(admin,ben.client,'mixed'); outsider=await actor(admin,ben.client,'outsider');
  a=await project(ben.client,'א'); b=await project(ben.client,'ב');
  for(const person of [manager,finance,mixed]) await membership(ben.client,person.id,a.id,'manager');
  await membership(ben.client,worker.id,a.id,'worker'); await membership(ben.client,mixed.id,b.id,'worker');
  await value(ben.client,'set_finance_access',{userId:finance.id,projectId:a.id,enabled:true,expectedRevision:1});
},120_000);

describe.sequential('מטריצת P01–P31 ישירות ל-Data API עם JWT אמיתי', () => {
  it('P01+/- סשן פעיל, לא מחובר ומשתמש ללא שיוך',async()=>{
    for(const person of [ben,manager,finance,worker,mixed]) expect(await value(person.client,'get_actor')).toMatchObject({userId:person.id});
    await deny(anonymous,'get_actor',{});
    expect(await rows(outsider.client,'projects','id',a.id)).toEqual([]);
    const badLogin=await anonymous.auth.signInWithPassword({email:`missing-${randomUUID()}@example.invalid`,password:randomUUID()}); expect(badLogin.error).not.toBeNull();
  });
  it('P02+/- פרויקט, פרטים פרטיים ובידוד בין פרויקטים',async()=>{
    expect(await rows(mixed.client,'projects','id',a.id)).toHaveLength(1);
    expect(await rows(mixed.client,'projects','id',b.id)).toHaveLength(1);
    expect(await rows(worker.client,'projects','id',b.id)).toEqual([]);
    const privateRows=await worker.client.from('project_private').select('*').eq('project_id',a.id); expect(privateRows.data).toEqual([]);
    await deny(worker.client,'project_permissions',{projectId:b.id},'NOT_FOUND');
  });
  it('P03/P04+/- רק בעלים משנה שיוך ותפקיד',async()=>{
    for(const person of [manager,finance,worker]) {
      await deny(person.client,'set_membership',{userId:person.id,projectId:b.id,role:'manager',expectedRevision:null},'FORBIDDEN');
      await deny(person.client,'remove_membership',{userId:person.id,projectId:a.id,expectedRevision:1},'FORBIDDEN');
    }
    await membership(ben.client,outsider.id,b.id,'worker');
    const changed=await value(ben.client,'set_membership',{userId:outsider.id,projectId:b.id,role:'manager',expectedRevision:1});expect(changed).toMatchObject({revision:2,financeAccess:false});
    await value(ben.client,'remove_membership',{userId:outsider.id,projectId:b.id,expectedRevision:2});
  });
  it('P05/P06+/- ניהול משתמשים, ביטול סשן והשבתת בעלים',async()=>{
    const person=await actor(admin,ben.client,'revoked');
    await membership(ben.client,person.id,a.id,'worker');
    for(const action of ['create_profile','revoke_user_sessions','set_user_active'] as const) await deny(manager.client,action,{},'FORBIDDEN');
    const ownerRevision=(await ben.client.from('profiles').select('revision').eq('id',ben.id).single()).data!.revision;
    await deny(ben.client,'set_user_active',{id:ben.id,active:false,expectedRevision:ownerRevision},'FORBIDDEN');
    await value(ben.client,'revoke_user_sessions',{id:person.id});
    expect(await value(person.client,'get_actor')).toBeNull();expect(await rows(person.client,'projects','id',a.id)).toEqual([]);
    const disabled=await actor(admin,ben.client,'disabled');
    await value(ben.client,'set_user_active',{id:disabled.id,active:false,expectedRevision:1});
    expect(await value(disabled.client,'get_actor')).toBeNull();
    await value(ben.client,'set_user_active',{id:disabled.id,active:true,expectedRevision:2});
    expect(await value(disabled.client,'get_actor')).toBeNull();
  });
  it('P07+/- יצירה בידי בעלים בלבד ואידמפוטנטיות בתחרות',async()=>{
    const input={requestId:randomUUID(),fields:{name:'בדיקה',businessName:'בדוי',siteAddress:'בדיקה',contact:{name:'בדיקה',phone:'0',email:null,roleTitle:null},startDate:null,endDate:null,accessNotes:null}};
    const [first,second]=await Promise.all([value<Saved>(ben.client,'create_project',input),value<Saved>(ben.client,'create_project',input)]);expect(first.id).toBe(second.id);
    for(const person of [manager,finance,worker]) await deny(person.client,'create_project',input,'FORBIDDEN');
  });
  it('P08+/- מנהל עורך רק בפרויקט שלו, בלי מספר חברה',async()=>{
    const p=await project(ben.client,'עריכה');await membership(ben.client,manager.id,p.id,'manager');
    const input={id:p.id,expectedRevision:1,fields:{name:'שם מעודכן',businessName:'בדוי',siteAddress:'בדיקה',contact:{name:'בדיקה',phone:'0',email:null,roleTitle:null},startDate:null,endDate:null,accessNotes:null}};
    expect(await value(manager.client,'update_project',input)).toMatchObject({revision:2});
    await deny(worker.client,'update_project',input,'NOT_FOUND');
    await deny(manager.client,'update_project',{...input,expectedRevision:2,fields:{...input.fields,businessNumber:'TEST'}},'FORBIDDEN');
    await deny(mixed.client,'update_project',{...input,id:b.id},'FORBIDDEN');
  });
  it('P09+/- שער לבעלים בלבד וקובץ מפרויקט אחר נדחה',async()=>{
    const fileId=await readyFile(admin,ben,a.id,'cover');
    a=await value(ben.client,'set_project_cover',{id:a.id,expectedRevision:a.revision,fileId});
    expect(await value(worker.client,'authorize_file',{fileId,variant:'original'})).toMatchObject({bucket:'originals'});
    await deny(manager.client,'begin_upload',{projectId:a.id,purpose:'cover',files:[]},'FORBIDDEN');
    const other=await readyFile(admin,ben,b.id,'cover');await deny(ben.client,'set_project_cover',{id:a.id,expectedRevision:a.revision,fileId:other},'NOT_FOUND');
  });
  it('P10/P11+/- סיום וארכיון לבעלים בלבד',async()=>{
    for(const person of [manager,finance,worker]) {
      await deny(person.client,'set_project_status',{id:a.id,expectedRevision:a.revision,status:'completed'},'FORBIDDEN');
      await deny(person.client,'set_project_archived',{id:a.id,expectedRevision:a.revision,archived:true},'FORBIDDEN');
    }
    const p=await project(ben.client,'מצב');
    expect(await value(ben.client,'set_project_status',{id:p.id,expectedRevision:1,status:'completed'})).toMatchObject({revision:2});
    expect(await value(ben.client,'set_project_archived',{id:p.id,expectedRevision:2,archived:true})).toMatchObject({revision:3});
  });
  it('P12/P13/P14+/- שלוש גישות, אין זכות מיוחדת למעלה ומועמדים מצומצמים',async()=>{
    for(const access of [{mode:'owner'},{mode:'all'},{mode:'selected',userIds:[worker.id]}]) {
      const fileId=await readyFile(admin,manager,a.id,'document');
      const doc=await value<Saved>(manager.client,'create_document',{projectId:a.id,fileId,category:'plans',access});
      expect(await rows(worker.client,'documents','id',doc.id)).toHaveLength(access.mode==='owner'?0:1);
      expect(await rows(manager.client,'documents','id',doc.id)).toHaveLength(access.mode==='all'?1:0);
      if(access.mode!=='all')await deny(manager.client,'authorize_file',{fileId,variant:'original'},'NOT_FOUND');
    }
    const candidates=await value<{userId:string;fullName:string}[]>(manager.client,'project_access_candidates',{projectId:a.id});
    expect(candidates.length).toBeGreaterThan(0);for(const candidate of candidates)expect(Object.keys(candidate).sort()).toEqual(['fullName','userId']);
    await deny(mixed.client,'project_access_candidates',{projectId:b.id},'FORBIDDEN');
    await deny(worker.client,'begin_upload',{projectId:a.id,purpose:'document',files:[]},'FORBIDDEN');
    const fileId=await readyFile(admin,manager,a.id,'document');
    for(const access of [{mode:'selected',userIds:[]},{mode:'selected',userIds:[outsider.id]}])await deny(manager.client,'create_document',{projectId:a.id,fileId,category:'plans',access},'VALIDATION');
    await deny(manager.client,'create_document',{projectId:a.id,fileId,category:'plans'},'VALIDATION');
  });
  it('P15/P16+/- שינוי גישה, החלפה וארכיון לבעלים בלבד',async()=>{
    const fileId=await readyFile(admin,manager,a.id,'document');const doc=await value<Saved>(manager.client,'create_document',{projectId:a.id,fileId,category:'plans',access:{mode:'all'}});
    await deny(manager.client,'set_document_access',{id:doc.id,expectedRevision:1,access:{mode:'owner'}},'FORBIDDEN');
    await value(ben.client,'set_document_access',{id:doc.id,expectedRevision:1,access:{mode:'owner'}});
    expect(await rows(manager.client,'documents','id',doc.id)).toEqual([]);
    await deny(manager.client,'set_document_archived',{id:doc.id,expectedRevision:2,archived:true},'FORBIDDEN');
    const replacement=await readyFile(admin,ben,a.id,'document');
    await value(ben.client,'create_document',{projectId:a.id,fileId:replacement,category:'plans',access:{mode:'all'},replacesDocumentId:doc.id});
    expect((await rows(ben.client,'documents','id',doc.id))[0]).toMatchObject({archived_at:expect.any(String)});
  });
  it('P17/P18/P19+/- פתקים משותפים, מחיקה רק לבעלים ותחרות עריכות',async()=>{
    const task=await value<Saved>(manager.client,'create_task',taskInput(a.id));
    const results=await Promise.all([rpc(worker.client,'update_task',{id:task.id,expectedRevision:1,body:'א',dueDate:null}),rpc(worker.client,'update_task',{id:task.id,expectedRevision:1,body:'ב',dueDate:null})]);
    expect(results.filter(r=>!r.error)).toHaveLength(1);expect(results.find(r=>r.error)?.error?.message).toBe('CONFLICT');
    await value(worker.client,'set_task_completed',{id:task.id,expectedRevision:2,completed:true});
    await deny(manager.client,'delete_task',{id:task.id,expectedRevision:3},'FORBIDDEN');
    await value(ben.client,'delete_task',{id:task.id,expectedRevision:3});
    await deny(worker.client,'update_task',{id:task.id,expectedRevision:4,body:'לא',dueDate:null},'NOT_FOUND');
    await deny(worker.client,'create_task',taskInput(b.id),'NOT_FOUND');
  });
  it('P20/P21+/- יומן, קבצים, כפילות, עתיד וזיוף זמן ומבצע',async()=>{
    const fileId=await readyFile(admin,worker,a.id,'diary');const input=entryInput(a.id,[fileId]);
    const [first,second]=await Promise.all([value<Saved>(worker.client,'create_entry',input),value<Saved>(worker.client,'create_entry',input)]);expect(first.id).toBe(second.id);
    expect(await rows(manager.client,'diary_entries','id',first.id)).toHaveLength(1);
    expect(await rows(worker.client,'diary_versions','entry_id',first.id)).toHaveLength(1);
    expect(await value(worker.client,'authorize_file',{fileId,variant:'original'})).toMatchObject({bucket:'originals'});
    for(const patch of [{reporterId:ben.id},{enteredAt:'2020-01-01'},{editedAt:'2020-01-01'},{workDate:'2099-01-01'}])await deny(worker.client,'create_entry',{...entryInput(a.id),...patch},'VALIDATION');
    const other=await readyFile(admin,manager,a.id,'diary');await deny(worker.client,'create_entry',entryInput(a.id,[other]),'NOT_FOUND');
  });
  it('P22/P23/P24/P25+/- תיקון עצמי, תיקון בעלים, העברה וביטול ללא חשיפת גרסאות מקור',async()=>{
    const entry=await value<Saved>(worker.client,'create_entry',entryInput(a.id));
    await value(worker.client,'correct_entry',{id:entry.id,expectedRevision:1,body:'תיקון',fileIds:[]});
    await deny(manager.client,'correct_entry',{id:entry.id,expectedRevision:2,body:'אחר',fileIds:[]},'FORBIDDEN');
    for(const name of ['move_entry','cancel_entry'] as const)await deny(worker.client,name,{id:entry.id,expectedRevision:2,projectId:b.id,workDate:'2026-01-01'},'FORBIDDEN');
    await value(ben.client,'correct_entry',{id:entry.id,expectedRevision:2,body:'תיקון בעלים',fileIds:[]});
    await value(ben.client,'move_entry',{id:entry.id,expectedRevision:3,projectId:b.id,workDate:'2026-01-02'});
    expect(await rows(worker.client,'diary_entries','id',entry.id)).toEqual([]);
    const versions=await rows(mixed.client,'diary_versions','entry_id',entry.id);expect(versions).toHaveLength(1);expect(versions[0]).toMatchObject({version:4});
    await value(ben.client,'cancel_entry',{id:entry.id,expectedRevision:4});
    expect(await rows(mixed.client,'diary_entries','id',entry.id)).toEqual([]);expect(await rows(ben.client,'diary_versions','entry_id',entry.id)).toHaveLength(5);
    const summary=await value<{reportCount:number}>(mixed.client,'diary_summary',{projectId:b.id});expect(summary.reportCount).toBe(0);
  });
  it('P26/P27/P28/P29+/- כספים לפי שיוך, ביטול וסיכום לבעלים בלבד',async()=>{
    const tx=await transaction(finance.client,a.id);
    for(const person of [manager,worker,outsider]) {
      expect(await rows(person.client,'transactions','id',tx.id)).toEqual([]);
      await deny(person.client,'finance_month_totals',{projectId:a.id},'NOT_FOUND');
    }
    await deny(finance.client,'finance_month_totals',{projectId:b.id},'NOT_FOUND');
    await value(finance.client,'update_transaction',{id:tx.id,expectedRevision:1,fields:{...fields,amount:17}});
    await deny(finance.client,'cancel_transaction',{id:tx.id,expectedRevision:2},'FORBIDDEN');
    await deny(finance.client,'finance_all_month_totals',{},'FORBIDDEN');
    expect(await value(ben.client,'finance_all_month_totals',{})).toEqual(expect.arrayContaining([expect.objectContaining({projectId:a.id,income:17})]));
    await value(ben.client,'cancel_transaction',{id:tx.id,expectedRevision:2});
    expect(await rows(finance.client,'transactions','id',tx.id)).toEqual([]);
    await deny(finance.client,'update_transaction',{id:tx.id,expectedRevision:3,fields},'CONFLICT');
    await deny(worker.client,'set_finance_access',{userId:worker.id,projectId:a.id,enabled:true,expectedRevision:1},'FORBIDDEN');
    await deny(ben.client,'set_finance_access',{userId:worker.id,projectId:a.id,enabled:true,expectedRevision:1},'VALIDATION');
  });
  it('P30/P31/X15+/- לוג וגרסאות בלתי ניתנים לשינוי לכל תפקיד כולל בעלים ו-service_role',async()=>{
    expect((await rows(ben.client,'sensitive_events','project_id',a.id)).length).toBeGreaterThan(0);
    for(const person of [manager,finance,worker])expect(await rows(person.client,'sensitive_events','project_id',a.id)).toEqual([]);
    const tables=['profiles','projects','memberships','project_contacts','project_private','project_finance_settings','project_covers','stored_files','documents','document_grants','tasks','diary_entries','diary_versions','diary_attachments','diary_version_files','transactions','sensitive_events'] as const;
    for(const client of [ben.client,manager.client,worker.client,admin])for(const table of tables) {
      // A filter matching no rows still requires UPDATE/DELETE privileges.
      const column=['memberships','project_contacts','project_private','project_finance_settings','document_grants'].includes(table)?'project_id':table==='diary_versions'||table==='diary_version_files'?'entry_id':'id';
      const insert=await client.from(table).insert({} as never);expect(insert.error,`${table} insert`).not.toBeNull();
      const update=await client.from(table).update({[column]:column==='id'&&table==='sensitive_events'?0:randomUUID()} as never).eq(column as never,column==='id'&&table==='sensitive_events'?0:randomUUID());expect(update.error,`${table} update`).not.toBeNull();
      const deletion=await client.from(table).delete().eq(column as never,column==='id'&&table==='sensitive_events'?0:randomUUID());expect(deletion.error,`${table} delete`).not.toBeNull();
    }
    expect((await admin.from('projects').select('id')).error).not.toBeNull();
  },120_000);
});

describe.sequential('מצבי X והרשאות חוצות',()=>{
 it('X01/X02 הסרה ושיוך מחדש אינם מחזירים כספים או הרשאת מסמך',async()=>{
  const person=await actor(admin,ben.client,'removed');await membership(ben.client,person.id,a.id,'manager');
  await value(ben.client,'set_finance_access',{userId:person.id,projectId:a.id,enabled:true,expectedRevision:1});
  const fileId=await readyFile(admin,ben,a.id,'document');
  const doc=await value<Saved>(ben.client,'create_document',{projectId:a.id,fileId,category:'plans',access:{mode:'selected',userIds:[person.id]}});
  const entry=await value<Saved>(person.client,'create_entry',entryInput(a.id));
  await value(ben.client,'remove_membership',{userId:person.id,projectId:a.id,expectedRevision:2});
  expect(await rows(person.client,'projects','id',a.id)).toEqual([]);
  await deny(person.client,'correct_entry',{id:entry.id,expectedRevision:1,body:'תיקון',fileIds:[]},'NOT_FOUND');
  await deny(person.client,'authorize_file',{fileId,variant:'original'},'NOT_FOUND');
  expect(await membership(ben.client,person.id,a.id,'manager')).toMatchObject({financeAccess:false});
  expect(await rows(person.client,'documents','id',doc.id)).toEqual([]);
  await deny(person.client,'finance_month_totals',{projectId:a.id},'NOT_FOUND');
 });
 it('X03/X18 כמה מנהלים וכספים מתבטלים בהורדה לעובד',async()=>{
  const person=await actor(admin,ben.client,'demoted');await membership(ben.client,person.id,a.id,'manager');
  await value(ben.client,'set_finance_access',{userId:person.id,projectId:a.id,enabled:true,expectedRevision:1});
  await transaction(person.client,a.id);
  await value(ben.client,'set_membership',{userId:person.id,projectId:a.id,role:'worker',expectedRevision:2});
  await deny(person.client,'finance_month_totals',{projectId:a.id},'NOT_FOUND');
  expect(await value(ben.client,'set_membership',{userId:person.id,projectId:a.id,role:'manager',expectedRevision:3})).toMatchObject({financeAccess:false});
  expect((await value<string[]>(worker.client,'project_manager_names',{projectId:a.id})).length).toBeGreaterThan(1);
 });
 it('X04 יציאה חוסמת JWT שעדיין לא פג',async()=>{
  const person=await actor(admin,ben.client,'logout');await membership(ben.client,person.id,a.id,'worker');
  const token=(await person.client.auth.getSession()).data.session?.access_token;
  expect(token).toBeTruthy();
  const {createClient}=await import('@supabase/supabase-js');
  const {environment}=await import('./support/cloud');const env=environment();
  const stale=createClient(env.url,env.publishable,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}}) as Client;
  const signedOut=await person.client.auth.signOut({scope:'local'});expect(signedOut.error).toBeNull();
  expect(await value(stale,'get_actor')).toBeNull();expect(await rows(stale,'projects','id',a.id)).toEqual([]);
 });
 for(const state of ['completed','archived'] as const)it(`X06/X07/X08/X09 ${state}: אחת עשרה כתיבות חסומות, קריאה נשארת ובן כותב`,async()=>{
  const p=await project(ben.client,state);await membership(ben.client,finance.id,p.id,'manager');await membership(ben.client,worker.id,p.id,'worker');
  await value(ben.client,'set_finance_access',{userId:finance.id,projectId:p.id,enabled:true,expectedRevision:1});
  const task=await value<Saved>(worker.client,'create_task',taskInput(p.id));
  const entry=await value<Saved>(worker.client,'create_entry',entryInput(p.id));
  const tx=await transaction(finance.client,p.id);const fileId=await readyFile(admin,finance,p.id,'document');
  const stateInput=state==='completed'?{status:'completed'}:{archived:true};
  await value(ben.client,state==='completed'?'set_project_status':'set_project_archived',{id:p.id,expectedRevision:1,...stateInput});
  const cases: [Client,Parameters<typeof rpc>[1],Json][]=[
   [finance.client,'update_project',{id:p.id,expectedRevision:2,fields:{}}],
   [finance.client,'begin_upload',{projectId:p.id,purpose:'document',files:[]}],
   [finance.client,'create_document',{projectId:p.id,fileId,category:'plans',access:{mode:'all'}}],
   [worker.client,'create_task',taskInput(p.id)],
   [worker.client,'update_task',{id:task.id,expectedRevision:1,body:'עדכון',dueDate:null}],
   [worker.client,'set_task_completed',{id:task.id,expectedRevision:1,completed:true}],
   [worker.client,'create_entry',entryInput(p.id)],
   [worker.client,'correct_entry',{id:entry.id,expectedRevision:1,body:'עדכון',fileIds:[]}],
   [finance.client,'create_transaction',{requestId:randomUUID(),projectId:p.id,fields}],
   [finance.client,'update_transaction',{id:tx.id,expectedRevision:1,fields}],
   [finance.client,'set_finance_link',{projectId:p.id,expectedRevision:1,url:null}],
  ];
  for(const [client,name,input] of cases)await deny(client,name,input,'PROJECT_READ_ONLY');
  expect(await rows(worker.client,'diary_entries','id',entry.id)).toHaveLength(1);
  expect(await value(worker.client,'diary_summary',{projectId:p.id})).toMatchObject({reportCount:1,workDays:1});
  await value(ben.client,'create_task',taskInput(p.id));
  await value(ben.client,state==='completed'?'set_project_status':'set_project_archived',{id:p.id,expectedRevision:2,...(state==='completed'?{status:'active'}:{archived:false})});
  await value(worker.client,'create_task',taskInput(p.id));
 });
 it('X12 הסרה בין תחילת העלאה לסיומה חוסמת סיום גם ב-service_role',async()=>{
  const person=await actor(admin,ben.client,'uploadremoved');await membership(ben.client,person.id,a.id,'worker');
  const files=await value<{fileId:string}[]>(person.client,'begin_upload',{projectId:a.id,purpose:'diary',files:[{clientId:randomUUID(),name:'בדיקה.png',mime:'image/png',sizeBytes:8}]});
  expect(await value(person.client,'get_pending_upload',{fileId:files[0].fileId})).toMatchObject({fileId:files[0].fileId});
  await value(ben.client,'remove_membership',{userId:person.id,projectId:a.id,expectedRevision:1});
  await deny(admin,'system_finish_upload',{fileId:files[0].fileId,actorId:person.id,sessionId:person.sessionId,state:'rejected'},'FORBIDDEN');
  await deny(person.client,'get_pending_upload',{fileId:files[0].fileId},'NOT_FOUND');
 });
 it('נתונים כספיים: ימים אמיתיים, שלמים, החזרים וסיכומים',async()=>{
  const p=await project(ben.client,'כספים');
  for(const patch of [{amount:0},{amount:1.2},{amount:100000000001},{month:13},{year:1999},{month:2,day:30},{amount:'100'}])await deny(ben.client,'create_transaction',{requestId:randomUUID(),projectId:p.id,fields:{...fields,...patch}},'VALIDATION');
  for(const [kind,amount] of [['income',10050],['income_refund',50],['expense',6000],['expense_credit',1000]] as const)await value(ben.client,'create_transaction',{requestId:randomUUID(),projectId:p.id,fields:{...fields,kind,amount}});
  expect(await value(ben.client,'finance_month_totals',{projectId:p.id})).toEqual([{year:2026,month:1,income:10000,expense:5000}]);
  await value(ben.client,'set_finance_link',{projectId:p.id,expectedRevision:1,url:'https://example.invalid/book'});
  await deny(ben.client,'set_finance_link',{projectId:p.id,expectedRevision:2,url:'javascript:alert(1)'},'VALIDATION');
 });
 it('פונקציות system אינן פתוחות למשתמשים, והקמת בעלים שנייה נדחית',async()=>{
  for(const person of [ben,manager,worker])for(const name of ['system_bootstrap_owner','system_owner_recovered','system_finish_upload'] as const)await deny(person.client,name,{});
  await deny(admin,'system_bootstrap_owner',{userId:ben.id,fullName:'אחר'},'CONFLICT');
 });
});

describe.sequential('חוזי RPC משלימים',()=>{
 it('update_profile מסנכרנת אימייל מ-Auth בלבד ושומרת גרסה',async()=>{
  const person=await actor(admin,ben.client,'profileedit');
  const profile=(await ben.client.from('profiles').select('email').eq('id',person.id).single()).data;
  expect(profile).not.toBeNull();
  await deny(manager.client,'update_profile',{id:person.id,expectedRevision:1,fullName:'בדיקה',email:profile!.email},'FORBIDDEN');
  await deny(ben.client,'update_profile',{id:person.id,expectedRevision:1,fullName:'בדיקה',email:'different@example.invalid'},'VALIDATION');
  expect(await value(ben.client,'update_profile',{id:person.id,expectedRevision:1,fullName:'שם בדוי מעודכן',email:profile!.email})).toMatchObject({revision:2});
 });
 it('מגבלות העלאה ו-finalize סותר נדחה',async()=>{
  for(const patch of [{sizeBytes:52428801},{mime:'text/html'},{sizeBytes:1.2}]) {
   const result=await rpc(manager.client,'begin_upload',{projectId:a.id,purpose:'document',files:[{clientId:randomUUID(),name:'בדיקה',mime:'image/png',sizeBytes:1,...patch}]});expect(result.error).not.toBeNull();
  }
  const fileId=await readyFile(admin,manager,a.id,'document');
  await deny(admin,'system_finish_upload',{fileId,actorId:manager.id,sessionId:manager.sessionId,state:'rejected'},'CONFLICT');
  expect(await value(manager.client,'get_pending_upload',{fileId})).toMatchObject({fileId,state:'ready',fileRef:{id:fileId}});
 });
 it('project_cards מונה רק נתונים גלויים ומחזירה מבנה משותף',async()=>{
  const p=await project(ben.client,'מונים');await membership(ben.client,worker.id,p.id,'worker');
  const entry=await value<Saved>(worker.client,'create_entry',entryInput(p.id));
  const task=await value<Saved>(worker.client,'create_task',taskInput(p.id));
  const cards=await value<{id:string;reportCount:number;openTaskCount:number}[]>(worker.client,'project_cards',{});
  expect(cards.find(c=>c.id===p.id)).toMatchObject({reportCount:1,openTaskCount:1});
  expect(cards.some(c=>c.id===b.id)).toBe(false);
  await value(ben.client,'cancel_entry',{id:entry.id,expectedRevision:1});await value(ben.client,'delete_task',{id:task.id,expectedRevision:1});
  const updated=await value<{id:string;reportCount:number;openTaskCount:number}[]>(worker.client,'project_cards',{});
  expect(updated.find(c=>c.id===p.id)).toMatchObject({reportCount:0,openTaskCount:0});
 });
 it('system_owner_recovered מבטלת את הסשן הישן והבעלים נכנס מחדש',async()=>{
  await value(admin,'system_owner_recovered',{supportId:'p12-test-support'});
  expect(await value(ben.client,'get_actor')).toBeNull();
  ben=await owner(admin);expect(await value(ben.client,'get_actor')).toMatchObject({isOwner:true});
 });
});
