import {randomBytes,randomUUID} from 'node:crypto';
import {beforeAll,describe,expect,it,vi} from 'vitest';
import type {Db,RequestContext} from '../../src/types/contracts';
vi.mock('server-only',()=>({}));
import {createAuthAdmin,createManagedUser} from '../../src/lib/auth/admin';
import {cloudActor,cloudClients,cloudOwner} from './support/cloud';

type Update=Db['auth']['admin']['updateUserById'];
let ben:RequestContext,admin:Db;
beforeAll(async()=>{ben=await cloudOwner();admin=cloudClients().admin;});
const address=()=>`p13-profile-${randomUUID()}@example.invalid`;
const realUpdate:Update=(...args)=>admin.auth.admin.updateUserById(...args);
function editor(run:Update=realUpdate) {
  const update=vi.fn(run),provider=vi.fn(()=>({auth:{admin:{updateUserById:update}}}) as unknown as Db);
  return {update,provider,service:createAuthAdmin({admin:provider})};
}
// No sign-in here: the sign-in rate limit is shared with the other cloud files.
async function person() {
  const input={requestId:randomUUID(),email:address(),password:randomBytes(32).toString('base64url'),fullName:'עריכת פרופיל בדויה'};
  const created=await createManagedUser(ben,input,{admin:()=>admin});
  if(!created.ok)throw new Error('יצירת משתמש בדוי נכשלה');
  const id=created.value.userId,start=await snapshot(id);
  return {id,email:input.email,password:input.password,start,edit:{userId:id,expectedRevision:start.revision,fullName:'שם בדוי מעודכן',email:address()}};
}
async function snapshot(id:string) {
  const profile=await ben.db.from('profiles').select('full_name,email,revision').eq('id',id).single();
  const auth=await admin.auth.admin.getUserById(id);
  if(profile.error || auth.error)throw new Error('קריאת מצב בדוי נכשלה');
  return {...profile.data,login:auth.data.user.email,identity:auth.data.user.identities?.find(item=>item.provider==='email')?.identity_data?.email as string|undefined};
}
async function committed(id:string,edit:{expectedRevision:number;fullName:string;email:string}) {
  expect(await snapshot(id)).toEqual({full_name:edit.fullName,email:edit.email,revision:edit.expectedRevision+1,login:edit.email,identity:edit.email});
}
async function signIn(email:string,password:string) {
  return (await cloudClients().publicClient().auth.signInWithPassword({email,password})).error;
}
async function prepare(ctx:RequestContext,edit:{userId:string;expectedRevision:number;fullName:string;email:string}) {
  const {userId:id,...fields}=edit;
  return ctx.db.rpc('prepare_profile_update',{input:{id,...fields}});
}

describe.sequential('עדכון אימייל אטומי מול ענן הפיתוח',()=>{
  it('success moves login, identity and profile together with one revision and one audit event',async()=>{
    const p=await person(),e=editor();
    expect(await e.service.setEmail(ben,p.edit)).toEqual({ok:true,value:{id:p.id,revision:p.start.revision+1}});
    await committed(p.id,p.edit);
    expect(await signIn(p.edit.email,p.password)).toBeNull();
    expect(await signIn(p.email,p.password)).not.toBeNull();
    const events=await ben.db.from('sensitive_events').select('actor_id').eq('entity_id',p.id).eq('action','user.updated');
    expect(events.data).toEqual([{actor_id:ben.actor.userId}]);
  });
  it('name-only edit saves without calling Auth',async()=>{
    const p=await person(),e=editor(),edit={...p.edit,email:p.email};
    expect(await e.service.setEmail(ben,edit)).toMatchObject({ok:true,value:{revision:p.start.revision+1}});
    await committed(p.id,edit);expect(e.provider).not.toHaveBeenCalled();
  });
  it('stale revision changes neither Auth nor the profile',async()=>{
    const p=await person(),e=editor();
    const renamed={...p.edit,email:p.email};
    expect((await e.service.setEmail(ben,renamed)).ok).toBe(true);
    expect(await e.service.setEmail(ben,p.edit)).toMatchObject({ok:false,error:{code:'CONFLICT'}});
    await committed(p.id,renamed);expect(e.provider).not.toHaveBeenCalled();
  });
  it('two concurrent edits from one revision commit exactly one',async()=>{
    const p=await person(),e=editor(),other={...p.edit,email:address(),fullName:'עריכה מקבילה'};
    const results=await Promise.all([e.service.setEmail(ben,p.edit),e.service.setEmail(ben,other)]);
    expect(results.filter(result=>result.ok)).toHaveLength(1);
    await committed(p.id,results[0].ok?p.edit:other);
  });
  it('edit between prepare and Auth rolls back login, identity and tokens',async()=>{
    const p=await person();
    // generateLink only creates a token; it does not send mail.
    const link=await admin.auth.admin.generateLink({type:'recovery',email:p.email});
    if(link.error)throw new Error('יצירת אסימון בדוי נכשלה');
    const renamed={...p.edit,fullName:'עריכה באמצע',email:p.email};
    let seen:Awaited<ReturnType<Update>>|undefined;
    const e=editor(async(...args)=>{
      const changed=await prepare(ben,renamed);if(changed.error)throw new Error('עריכת ביניים נכשלה');
      seen=await realUpdate(...args);return seen;
    });
    expect(await e.service.setEmail(ben,p.edit)).toMatchObject({ok:false,error:{code:'CONFLICT'}});
    // Asserted outside the mock: errors thrown inside it are swallowed by the service.
    expect(e.update).toHaveBeenCalledTimes(1);expect(seen?.error).toBeTruthy();
    await committed(p.id,renamed);
    const verified=await cloudClients().publicClient().auth.verifyOtp({type:'recovery',token_hash:link.data.properties.hashed_token});
    expect(verified.error).toBeNull();
  });
  it('unrelated revision bump is decided by the receipt, not by the profile content',async()=>{
    const p=await person(),prepares=vi.spyOn(ben.db,'rpc');
    try {
      const e=editor(async(...args)=>{
        const bumped=await ben.db.rpc('revoke_user_sessions',{input:{id:p.id}});if(bumped.error)throw new Error('העלאת גרסה בדויה נכשלה');
        return realUpdate(...args);
      });
      expect(await e.service.setEmail(ben,{...p.edit,fullName:p.start.full_name})).toMatchObject({ok:false,error:{code:'CONFLICT'}});
      expect(e.update).toHaveBeenCalledTimes(1);
      expect(prepares.mock.calls.filter(([name])=>name==='prepare_profile_update')).toHaveLength(2);
      expect(await snapshot(p.id)).toEqual({...p.start,revision:p.start.revision+1});
    } finally { prepares.mockRestore(); }
  });
  it('Auth failure before the change leaves everything and can be retried',async()=>{
    const p=await person();let first=true;
    const e=editor(async(...args)=>{if(first){first=false;throw new Error('simulated network failure');}return realUpdate(...args);});
    expect(await e.service.setEmail(ben,p.edit)).toMatchObject({ok:false,error:{code:'UNAVAILABLE'}});
    expect(await snapshot(p.id)).toEqual(p.start);
    expect((await e.service.setEmail(ben,p.edit)).ok).toBe(true);await committed(p.id,p.edit);
  });
  it('lost response after commit is Saved and a full retry repeats nothing',async()=>{
    const p=await person(),saved={ok:true,value:{id:p.id,revision:p.start.revision+1}};
    const e=editor(async(...args)=>{await realUpdate(...args);throw new Error('simulated lost response');});
    expect(await e.service.setEmail(ben,p.edit)).toEqual(saved);
    expect(await e.service.setEmail(ben,p.edit)).toEqual(saved);
    expect(e.update).toHaveBeenCalledTimes(1);await committed(p.id,p.edit);
  });
  it('retry after a later edit conflicts and never overwrites it',async()=>{
    const p=await person(),e=editor(),later={...p.edit,expectedRevision:p.start.revision+1,fullName:'עריכה מאוחרת'};
    expect((await e.service.setEmail(ben,p.edit)).ok).toBe(true);
    expect((await e.service.setEmail(ben,later)).ok).toBe(true);
    expect(await e.service.setEmail(ben,p.edit)).toMatchObject({ok:false,error:{code:'CONFLICT'}});
    expect(e.update).toHaveBeenCalledTimes(1);await committed(p.id,later);
  });
  it('late older Auth request is rejected both before and after the newer edit commits',async()=>{
    const p=await person(),newer={...p.edit,email:address()};
    const old={email:p.edit.email,email_confirm:true};
    expect((await prepare(ben,p.edit)).error).toBeNull();
    expect((await prepare(ben,newer)).error).toBeNull();
    expect((await realUpdate(p.id,old)).error).not.toBeNull();
    expect(await snapshot(p.id)).toEqual(p.start);
    expect((await editor().service.setEmail(ben,newer)).ok).toBe(true);
    expect((await realUpdate(p.id,old)).error).not.toBeNull();
    await committed(p.id,newer);
  });
  it('direct admin email change is rejected while password and orphan changes still work',async()=>{
    const p=await person();
    expect((await realUpdate(p.id,{email:p.edit.email,email_confirm:true})).error).not.toBeNull();
    expect(await snapshot(p.id)).toEqual(p.start);
    const password=randomBytes(32).toString('base64url');
    expect((await realUpdate(p.id,{password})).error).toBeNull();
    expect(await signIn(p.email,password)).toBeNull();
    const orphan=await admin.auth.admin.createUser({email:address(),password,email_confirm:true});
    if(orphan.error)throw new Error('יצירת חשבון בדוי נכשלה');
    expect((await realUpdate(orphan.data.user.id,{email:address(),email_confirm:true})).error).toBeNull();
  });
  it('actor session revoked after prepare cannot complete the edit',async()=>{
    const p=await person(),session=await cloudOwner();
    let seen:Awaited<ReturnType<Update>>|undefined;
    const e=editor(async(...args)=>{
      // Local scope only: the shared owner session must survive.
      const out=await session.db.auth.signOut({scope:'local'});if(out.error)throw new Error('ביטול סשן בדוי נכשל');
      seen=await realUpdate(...args);return seen;
    });
    expect(await e.service.setEmail(session,p.edit)).toMatchObject({ok:false,error:{code:'UNAVAILABLE'}});
    expect(seen?.error).toBeTruthy();
    expect(e.update).toHaveBeenCalledTimes(1);expect(await snapshot(p.id)).toEqual(p.start);
  });
  it('non-owner, forged and anonymous callers are refused',async()=>{
    const p=await person(),worker=await cloudActor(ben,'profile-update'),e=editor();
    for(const ctx of [worker.ctx,{...worker.ctx,actor:{...worker.ctx.actor,isOwner:true}}])expect(await e.service.setEmail(ctx,p.edit)).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
    expect((await prepare(worker.ctx,p.edit)).error?.message).toBe('FORBIDDEN');
    expect((await prepare({...ben,db:cloudClients().publicClient()},p.edit)).error).not.toBeNull();
    expect((await prepare({...ben,db:admin},p.edit)).error).not.toBeNull();
    expect(e.provider).not.toHaveBeenCalled();expect(await snapshot(p.id)).toEqual(p.start);
  });
  it('email of another profile or Auth account conflicts',async()=>{
    const p=await person(),other=await person(),e=editor(),orphanEmail=address();
    const orphan=await admin.auth.admin.createUser({email:orphanEmail,password:randomBytes(32).toString('base64url'),email_confirm:true});
    if(orphan.error)throw new Error('יצירת חשבון בדוי נכשלה');
    for(const email of [other.email.toUpperCase(),orphanEmail])expect(await e.service.setEmail(ben,{...p.edit,email})).toMatchObject({ok:false,error:{code:'CONFLICT'}});
    expect(e.provider).not.toHaveBeenCalled();expect(await snapshot(p.id)).toEqual(p.start);
  });
});
