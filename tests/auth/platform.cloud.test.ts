import {randomUUID} from 'node:crypto';
import {beforeAll, describe, expect, it, vi} from 'vitest';
import type {RequestContext} from '../../src/types/contracts';
vi.mock('server-only',()=>({}));
import {createAuthService} from '../../src/lib/auth/service';
import {permissions} from '../../src/lib/permissions';
import {createAuthAdmin,createManagedUser} from '../../src/lib/auth/admin';
import {cloudActor,cloudClients,cloudOwner} from './support/cloud';

let ben:RequestContext, worker:Awaited<ReturnType<typeof cloudActor>>;
let projectA:string,projectB:string;
const pass='not-a-real-user-password-123';
beforeAll(async()=>{
  ben=await cloudOwner();worker=await cloudActor(ben,'mixed-role');
  for(const label of ['a','b']) {
    const r=await ben.db.rpc('create_project',{input:{requestId:randomUUID(),fields:{name:`P13 ${label} ${randomUUID()}`,businessName:'בדוי',siteAddress:'בדיקה',contact:{name:'בדוי',phone:'0',email:null,roleTitle:null},startDate:null,endDate:null,accessNotes:null}}});
    if(r.error)throw new Error('יצירת פרויקט בדוי נכשלה');
    const id=(r.data as {id:string}).id;if(label==='a')projectA=id;else projectB=id;
    const assigned=await ben.db.rpc('set_membership',{input:{userId:worker.ctx.actor.userId,projectId:id,role:label==='a'?'manager':'worker',expectedRevision:null}});
    if(assigned.error)throw new Error('שיוך בדוי נכשל');
  }
},120000);

describe.sequential('Auth ו-Platform בפועל מול ענן הפיתוח',()=>{
  it('owner creates a named account, changes its email and resets its password without provider mail',async()=>{
    const {admin,publicClient}=cloudClients();
    const email=`p13-managed-${randomUUID()}@example.invalid`;
    const created=await createManagedUser(ben,{email,password:pass,fullName:'חשבון בדוי מנוהל'},{admin:()=>admin});
    expect(created.ok).toBe(true);if(!created.ok)return;
    const auth=createAuthService({db:publicClient(),authClient:cloudClients().admin});
    expect(await auth.signIn({email:email.toUpperCase(),password:pass})).toMatchObject({ok:true,value:{userId:created.value.userId,fullName:'חשבון בדוי מנוהל'}});
    const manager=createAuthAdmin({admin:()=>admin});
    const nextEmail=`p13-changed-${randomUUID()}@example.invalid`;
    expect(await manager.setEmail(ben,{userId:created.value.userId,email:nextEmail})).toEqual({ok:true,value:null});
    const profile=await ben.db.from('profiles').select('email').eq('id',created.value.userId).single();expect(profile.data?.email).toBe(nextEmail);
    const nextPassword=pass+'-changed';
    expect(await manager.setPassword(ben,{userId:created.value.userId,password:nextPassword})).toEqual({ok:true,value:null});
    expect(await auth.getContext()).toMatchObject({ok:false,error:{code:'UNAUTHENTICATED'}});
    expect(await auth.signIn({email:nextEmail,password:nextPassword})).toMatchObject({ok:true,value:{userId:created.value.userId}});
    expect(await auth.signOut()).toEqual({ok:true,value:null});
  });

  it('different roles and finance access are enforced per project',async()=>{
    expect(await permissions.forProject(worker.ctx,{projectId:projectA})).toMatchObject({ok:true,value:{view:true,editDetails:true,viewFinance:false}});
    expect(await permissions.forProject(worker.ctx,{projectId:projectB})).toMatchObject({ok:true,value:{view:true,editDetails:false,viewFinance:false}});
    await ben.db.rpc('set_finance_access',{input:{userId:worker.ctx.actor.userId,projectId:projectA,enabled:true,expectedRevision:1}});
    expect(await permissions.forProject(worker.ctx,{projectId:projectA})).toMatchObject({ok:true,value:{viewFinance:true}});
    expect(await permissions.forProject(worker.ctx,{projectId:projectB})).toMatchObject({ok:true,value:{viewFinance:false}});
  });
  it('completion removes writes without removing reads',async()=>{
    await ben.db.rpc('set_project_status',{input:{id:projectB,expectedRevision:1,status:'completed'}});
    expect(await permissions.forProject(worker.ctx,{projectId:projectB})).toMatchObject({ok:true,value:{view:true,report:false,writeTasks:false}});
  });
  it('forged owner flag does not enable administrative account changes',async()=>{
    const {admin}=cloudClients();const provider=vi.fn(()=>admin);
    const service=createAuthAdmin({admin:provider});
    const forged={...worker.ctx,actor:{...worker.ctx.actor,isOwner:true}};
    for(const result of [await service.createUser(forged,{email:`forbidden-${randomUUID()}@example.invalid`,password:pass}),await service.setPassword(forged,{userId:ben.actor.userId,password:pass}),await service.setEmail(forged,{userId:ben.actor.userId,email:'forbidden@example.invalid'})]) expect(result).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
    expect(provider).not.toHaveBeenCalled();
  });
  it('actual provider logout blocks the JWT on the next application request',async()=>{
    const person=await cloudActor(ben,'logout');const {admin}=cloudClients();
    const service=createAuthService({db:person.ctx.db,authClient:admin});
    expect(await service.getContext()).toMatchObject({ok:true});
    expect(await service.signOut()).toEqual({ok:true,value:null});
    expect(await service.getContext()).toMatchObject({ok:false,error:{code:'UNAUTHENTICATED'}});
  });
  it('disabled then reenabled account cannot reuse its previous session',async()=>{
    const person=await cloudActor(ben,'disabled');const {admin}=cloudClients();
    const service=createAuthService({db:person.ctx.db,authClient:admin});
    await ben.db.rpc('set_user_active',{input:{id:person.ctx.actor.userId,active:false,expectedRevision:1}});
    expect(await service.getContext()).toMatchObject({ok:false,error:{code:'UNAUTHENTICATED'}});
    await ben.db.rpc('set_user_active',{input:{id:person.ctx.actor.userId,active:true,expectedRevision:2}});
    expect(await service.getContext()).toMatchObject({ok:false,error:{code:'UNAUTHENTICATED'}});
  });
});
