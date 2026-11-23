import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {beforeAll,describe,expect,it,vi} from 'vitest';
import type {Platform,RequestContext,Saved,Result} from '../../../src/types/contracts';
vi.mock('server-only',()=>({}));
import {createDiaryApi} from '../../../src/features/diary/logic/service';
import {rpc,fetchAll} from '../../../src/lib/db/rpc';
import {permissions} from '../../../src/lib/permissions';
import {createStorageService} from '../../../src/lib/storage/service';
import {cloudActor,cloudOwner,cloudClients,cloudEnvironment} from '../../auth/support/cloud';
const api=createDiaryApi({rpc,fetchAll,permissions} as Platform);
let owner:RequestContext,worker:RequestContext,other:RequestContext,projectA:string,projectB:string,entryId:string,remainingEntry:string;
const must=<T>(r:Result<T>):T=>{expect(r.ok).toBe(true);if(!r.ok)throw new Error(r.error.code);return r.value;};
async function setupRpc(name:string,input:unknown){return must(await rpc<unknown,Saved>(owner,name,input));}
beforeAll(async()=>{
 owner=await cloudOwner();worker=(await cloudActor(owner,'diary-worker')).ctx;other=(await cloudActor(owner,'diary-other')).ctx;
 for(const label of ['a','b']){
 const p=await setupRpc('create_project',{requestId:randomUUID(),fields:{name:`Diary ${label} ${randomUUID()}`,businessName:'בדוי',siteAddress:'בדיקה',contact:{name:'בדוי',phone:'0',email:null,roleTitle:null},startDate:null,endDate:null,accessNotes:null}});
 if(label==='a')projectA=p.id;else projectB=p.id;
 await setupRpc('set_membership',{userId:worker.actor.userId,projectId:p.id,role:'worker',expectedRevision:null});
 await setupRpc('set_membership',{userId:other.actor.userId,projectId:p.id,role:'manager',expectedRevision:null});
 }
},120000);
describe.sequential('Diary real user-context orchestration',()=>{
 it('creates once, reports server provenance and rejects forged fields and future date',async()=>{
 const input={requestId:randomUUID(),projectId:projectA,workDate:'2026-11-20',body:'בדוי יומן',fileIds:[]};
 const first=must(await api.createEntry(worker,input));entryId=first.id;
 expect(must(await api.createEntry(worker,input))).toEqual(first);
 const row=must(await api.getEntry(worker,{id:entryId}));expect(row).toMatchObject({reporterId:worker.actor.userId,workDate:input.workDate,revision:1});expect(row.enteredAt).toBeTruthy();
 expect(await api.createEntry(worker,{...input,requestId:randomUUID(),workDate:'2099-01-01'})).toMatchObject({ok:false,error:{code:'VALIDATION'}});
 expect(await api.createEntry(worker,{...input,requestId:randomUUID(),reporterId:owner.actor.userId} as never)).toMatchObject({ok:false,error:{code:'VALIDATION'}});
 });
 it('allows self correction, denies manager correction and stale revision',async()=>{
 expect(await api.correctEntry(other,{id:entryId,expectedRevision:1,body:'אסור',fileIds:[]})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
 expect(must(await api.correctEntry(worker,{id:entryId,expectedRevision:1,body:'תיקון בדוי',fileIds:[]})).revision).toBe(2);
 expect(await api.correctEntry(worker,{id:entryId,expectedRevision:1,body:'ישן',fileIds:[]})).toMatchObject({ok:false,error:{code:'CONFLICT'}});
 expect(must(await api.listVersions(worker,{id:entryId}))).toHaveLength(2);
 expect(await api.moveEntry(worker,{id:entryId,expectedRevision:2,projectId:projectB,workDate:'2026-11-20'})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
 expect(await api.cancelEntry(worker,{id:entryId,expectedRevision:2})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
 });
 it('hydrates attached original metadata in order and rejects another uploader file',async()=>{
 const {admin,publicClient}=cloudClients();const env=cloudEnvironment();
 const storage=createStorageService({privileged:()=>admin,url:env.url,publishableKey:env.key});
 const bytes=await sharp({create:{width:2,height:2,channels:3,background:'#abcdef'}}).png().toBuffer();
 async function upload(ctx:RequestContext){
 const targets=must(await storage.beginUpload(ctx,{purpose:'diary',projectId:projectA,files:[{clientId:randomUUID(),name:'בדוי.png',mime:'image/png',sizeBytes:bytes.length}]}));
 const target=must(targets[0].target);const sent=await publicClient().storage.from(target.bucket).uploadToSignedUrl(target.path,target.token,bytes,{contentType:'image/png'});expect(sent.error).toBeNull();
 return must(await storage.finishUpload(ctx,{fileId:target.fileId}));
 }
 const foreign=await upload(other);
 expect(await api.createEntry(worker,{requestId:randomUUID(),projectId:projectA,workDate:'2026-11-20',body:'אסור',fileIds:[foreign.id]})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});
 const own=await upload(worker);
 must(await api.correctEntry(worker,{id:entryId,expectedRevision:2,body:'קובץ בדוי',fileIds:[own.id]}));
 const row=must(await api.getEntry(worker,{id:entryId}));expect(row.files).toEqual([own]);
 const report=must(await api.listForReport(worker,{scope:{kind:'entry',entryId}}));expect(report[0].files).toEqual([own]);
 const versions=must(await api.listVersions(worker,{id:entryId}));expect(versions.find(v=>v.version===3)?.files).toEqual([own]);
 });
 it('preserves date bounds, distinct workdays and complete report extraction',async()=>{
 for(let i=0;i<52;i++)must(await api.createEntry(worker,{requestId:randomUUID(),projectId:projectA,workDate:i===51?'2026-11-19':'2026-11-20',body:`בדוי ${i}`,fileIds:[]}));
 const summary=must(await api.getSummary(worker,{projectId:projectA,from:'2026-11-19',to:'2026-11-20'}));expect(summary).toMatchObject({reportCount:53,workDays:2});
 const first=must(await api.listEntries(worker,{projectId:projectA,from:'2026-11-19',to:'2026-11-20'}));remainingEntry=first.items.find(r=>r.id!==entryId)!.id;expect(first.items).toHaveLength(50);expect(first.nextCursor).toBeTruthy();
 const second=must(await api.listEntries(worker,{projectId:projectA,from:'2026-11-19',to:'2026-11-20',cursor:first.nextCursor!}));expect(second.items).toHaveLength(3);expect(new Set([...first.items,...second.items].map(r=>r.id)).size).toBe(53);
 expect(must(await api.listForReport(worker,{scope:{kind:'range',projectId:projectA,from:'2026-11-19',to:'2026-11-20'}}))).toHaveLength(53);
 expect(must(await api.listForReport(worker,{scope:{kind:'day',projectId:projectA,date:'2026-11-19'}}))).toHaveLength(1);
 expect(await api.listEntries(worker,{from:'2026-11-20',to:'2026-11-19'})).toMatchObject({ok:false,error:{code:'VALIDATION'}});
 },120000);
 it('hides old-project versions after move and cancelled entries from reports and totals',async()=>{
 must(await api.moveEntry(owner,{id:entryId,expectedRevision:3,projectId:projectB,workDate:'2026-11-18'}));
 await setupRpc('remove_membership',{projectId:projectA,userId:worker.actor.userId,expectedRevision:1});
 const versions=must(await api.listVersions(worker,{id:entryId}));expect(versions.length).toBeGreaterThan(0);expect(versions.every(v=>v.projectId===projectB)).toBe(true);
 expect(await api.listEntries(worker,{projectId:projectA})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});
 expect(await api.getEntry(worker,{id:remainingEntry})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});
 expect(await api.correctEntry(worker,{id:remainingEntry,expectedRevision:1,body:'אסור לאחר הסרה',fileIds:[]})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});
 expect(await api.listForReport(worker,{scope:{kind:'entry',entryId:remainingEntry}})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});
 must(await api.cancelEntry(owner,{id:entryId,expectedRevision:4}));
 expect(must(await api.getSummary(worker,{projectId:projectB})).reportCount).toBe(0);
 expect(must(await api.listForReport(owner,{scope:{kind:'day',projectId:projectB,date:'2026-11-18'}}))).toHaveLength(0);
 });
 it('completed projects remain readable and deny writes',async()=>{
 await setupRpc('set_project_status',{id:projectB,expectedRevision:1,status:'completed'});
 expect(await api.createEntry(worker,{requestId:randomUUID(),projectId:projectB,workDate:'2026-11-20',body:'אסור',fileIds:[]})).toMatchObject({ok:false,error:{code:'PROJECT_READ_ONLY'}});
 expect((await api.listEntries(worker,{projectId:projectB})).ok).toBe(true);
 });
});
