import {describe,expect,it,vi} from 'vitest';
import type {Db,RequestContext,Saved} from '../../src/types/contracts';
vi.mock('server-only',()=>({}));
import {createAuthAdmin,createManagedUser} from '../../src/lib/auth/admin';
const actor={userId:'2db95268-54da-42fa-bf62-2648ac3cc579',fullName:'בעלים בדוי',email:'owner@example.invalid',isOwner:true};
const target='6d54739e-32cf-44fb-9c7f-f26aef663d88';
const input={requestId:'2b9ffbe4-a9c6-4a47-a05a-d56337e7798c',email:'new@example.invalid',password:'fixture-password',fullName:'בדיקה חדשה'};
function fixture() {
  const rpc=vi.fn(async(name:string)=> name==='get_actor'?{data:actor,error:null}:name==='create_profile'?{data:{id:target,revision:1,passwordPending:true},error:null}:{data:null,error:null});
  const admin={createUser:vi.fn().mockResolvedValue({data:{user:{id:target}},error:null}),listUsers:vi.fn().mockResolvedValue({data:{users:[{id:target,email:input.email}]},error:null}),updateUserById:vi.fn().mockResolvedValue({data:{user:{id:target}},error:null})};
  const options={admin:vi.fn(()=>({auth:{admin}}) as unknown as Db)};
  const ctx:RequestContext={actor,db:{rpc} as unknown as Db,today:'2026-11-22'};
  return {rpc,admin,options,ctx};
}
describe('ניהול חשבונות: סדר פעולות וכשל חלקי',()=>{
  it('never sends a password to a database function',async()=>{
    const f=fixture();expect(await createManagedUser(f.ctx,input,f.options)).toMatchObject({ok:true,value:{userId:target}});
    expect(JSON.stringify(f.rpc.mock.calls)).not.toContain(input.password);
    expect(f.rpc).toHaveBeenCalledWith('create_profile',{input:{requestId:input.requestId,email:input.email,fullName:input.fullName}});
  });
  it('duplicate existing profile is never reset during creation retry',async()=>{
    const f=fixture();f.admin.createUser.mockResolvedValue({data:{user:null},error:{code:'email_exists'}});
    f.rpc.mockImplementation(async(name)=>name==='get_actor'?{data:actor,error:null}:{data:null,error:{message:'CONFLICT'}} as never);
    expect(await createManagedUser(f.ctx,input,f.options)).toMatchObject({ok:false,error:{code:'CONFLICT'}});
    expect(f.admin.updateUserById).not.toHaveBeenCalled();
  });
  it('password reset reports a revocation failure and can safely retry',async()=>{
    const f=fixture();let attempts=0;
    f.rpc.mockImplementation(async(name)=>name==='get_actor'?{data:actor,error:null}:{data:null,error:++attempts===1?{message:'network'}:null} as never);
    const service=createAuthAdmin(f.options);
    expect(await service.setPassword(f.ctx,{userId:target,password:input.password})).toMatchObject({ok:false,error:{code:'UNAVAILABLE'}});
    expect(await service.setPassword(f.ctx,{userId:target,password:input.password})).toEqual({ok:true,value:null});
    expect(f.admin.updateUserById).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(f.rpc.mock.calls)).not.toContain(input.password);
  });
  it('orphan-auth recovery remains finishable if password update fails after profile claim',async()=>{
    const f=fixture();let completed=false;
    f.admin.createUser.mockResolvedValue({data:{user:null},error:{code:'email_exists'}});
    f.rpc.mockImplementation(async(name)=>{
      if(name==='get_actor') return {data:actor,error:null};
      if(name==='create_profile')return {data:{id:target,revision:1,passwordPending:!completed},error:null};
      if(name==='complete_profile_creation')completed=true;
      return {data:null,error:null};
    });
    f.admin.updateUserById.mockResolvedValueOnce({data:{user:null},error:{message:'network'}}).mockResolvedValue({data:{user:{id:target}},error:null});
    expect(await createManagedUser(f.ctx,input,f.options)).toMatchObject({ok:false});
    expect(await createManagedUser(f.ctx,input,f.options)).toMatchObject({ok:true,value:{userId:target}});
    expect(completed).toBe(true);
    expect(f.rpc.mock.calls.some(([name])=>name==='revoke_user_sessions')).toBe(false);
  });
  it('lost completion response replays the receipt without resetting password again',async()=>{
    const f=fixture();let completed=false;
    f.admin.createUser.mockResolvedValue({data:{user:null},error:{code:'email_exists'}});
    f.rpc.mockImplementation(async(name)=>{
      if(name==='get_actor')return {data:actor,error:null};
      if(name==='create_profile')return {data:{id:target,revision:1,passwordPending:!completed},error:null};
      if(name==='complete_profile_creation'){completed=true;return {data:null,error:{message:'network'}} as never;}
      return {data:null,error:null};
    });
    expect(await createManagedUser(f.ctx,input,f.options)).toMatchObject({ok:false});
    expect(await createManagedUser(f.ctx,input,f.options)).toMatchObject({ok:true,value:{userId:target}});
    expect(f.admin.updateUserById).toHaveBeenCalledTimes(1);
    expect(f.rpc.mock.calls.filter(([name])=>name==='complete_profile_creation')).toHaveLength(1);
  });
});

const edit={userId:target,expectedRevision:4,fullName:'שם מעודכן',email:'changed@example.invalid'};
const saved={ok:true,value:{id:target,revision:5} satisfies Saved};
type Profile={full_name:string;email:string;revision:number};
const before:Profile={full_name:'שם קודם',email:'old@example.invalid',revision:4};
const after:Profile={full_name:edit.fullName,email:edit.email,revision:5};
// A small stand-in for the RPC and the Auth trigger: the profile changes only with a successful Auth commit.
function editFixture() {
  const state={profile:{...before},auth:before.email,intent:null as Profile|null,receipt:null as Profile|null,calls:[] as string[]};
  const commit=(next:Profile)=>{state.profile={...next};state.auth=next.email;state.receipt=next;state.intent=null;};
  const rpc=vi.fn(async(name:string,args:{input:unknown}):Promise<{data:unknown;error:unknown}>=>{
    if(name==='get_actor')return {data:actor,error:null};
    state.calls.push(name);
    if(name!=='prepare_profile_update')return {data:{id:target,revision:state.profile.revision},error:null};
    const given=args.input as {expectedRevision:number;fullName:string;email:string};
    const next={full_name:given.fullName,email:given.email,revision:given.expectedRevision+1};
    const reply=(emailPending:boolean)=>({data:{id:target,revision:state.profile.revision,emailPending},error:null});
    if(state.receipt && JSON.stringify(state.receipt)===JSON.stringify(next) && state.profile.revision===next.revision)return reply(false);
    if(given.expectedRevision!==state.profile.revision)return {data:null,error:{message:'CONFLICT'}};
    if(given.email===state.auth){commit(next);return reply(false);}
    state.intent=next;return reply(true);
  });
  const update=vi.fn(async(_id:string,attributes:{email:string;email_confirm:boolean}):Promise<{error:unknown}>=>{
    state.calls.push('auth');
    const intent=state.intent;
    if(!intent || intent.email!==attributes.email || intent.revision!==state.profile.revision+1)return {error:{status:500,code:'unexpected_failure',message:'Error updating user'}};
    commit(intent);return {error:null};
  });
  const read=vi.fn(async():Promise<{data:Profile|null;error:unknown}>=>{state.calls.push('read');return {data:{...state.profile},error:null};});
  const eq=vi.fn(()=>({maybeSingle:read})),select=vi.fn(()=>({eq})),from=vi.fn(()=>({select}));
  const provider=vi.fn(()=>({auth:{admin:{updateUserById:update}}}) as unknown as Db);
  const ctx:RequestContext={actor,db:{rpc,from} as unknown as Db,today:'2026-11-22'};
  return {state,commit,rpc,update,read,from,select,eq,provider,ctx,service:createAuthAdmin({admin:provider})};
}
describe('שינוי אימייל: הכנה, שינוי אטומי וקריאת התוצאה',()=>{
  it('prepares with the client revision, changes Auth and replays the receipt',async()=>{
    const f=editFixture();
    expect(await f.service.setEmail(f.ctx,{...edit,fullName:` ${edit.fullName} `,email:'  Changed@Example.invalid '})).toEqual(saved);
    expect(f.state.calls).toEqual(['prepare_profile_update','auth','read','prepare_profile_update']);
    expect(f.rpc).toHaveBeenCalledWith('prepare_profile_update',{input:{id:target,expectedRevision:4,fullName:edit.fullName,email:edit.email}});
    expect(f.update).toHaveBeenCalledWith(target,{email:edit.email,email_confirm:true});
    expect(f.from).toHaveBeenCalledWith('profiles');expect(f.select).toHaveBeenCalledWith('revision');expect(f.eq).toHaveBeenCalledWith('id',target);
  });
  it('name-only edit never creates the admin client',async()=>{
    const f=editFixture();
    expect(await f.service.setEmail(f.ctx,{...edit,email:before.email})).toEqual(saved);
    expect(f.state.calls).toEqual(['prepare_profile_update']);expect(f.provider).not.toHaveBeenCalled();
  });
  it('accepts an uppercase id for the same saved profile',async()=>{
    const f=editFixture();
    expect(await f.service.setEmail(f.ctx,{...edit,userId:target.toUpperCase()})).toEqual(saved);
  });
  it('stale edit is rejected before Auth and changes nothing',async()=>{
    const f=editFixture();
    expect(await f.service.setEmail(f.ctx,{...edit,expectedRevision:3})).toMatchObject({ok:false,error:{code:'CONFLICT'}});
    expect(f.provider).not.toHaveBeenCalled();expect(f.state).toMatchObject({profile:before,auth:before.email});
  });
  it.each([
    [{message:'FORBIDDEN'},{code:'FORBIDDEN'}],[{message:'NOT_FOUND'},{code:'NOT_FOUND'}],[{message:'CONFLICT'},{code:'CONFLICT'}],
    [{message:'VALIDATION',details:JSON.stringify({code:'VALIDATION',field:'email'})},{code:'VALIDATION',fieldErrors:{email:expect.any(String)}}],
    [{message:'network'},{code:'UNAVAILABLE'}],
  ])('prepare error %j returns without an admin client',async(error,expected)=>{
    const f=editFixture();f.rpc.mockImplementation(async name=>name==='get_actor'?{data:actor,error:null}:{data:null,error});
    expect(await f.service.setEmail(f.ctx,edit)).toMatchObject({ok:false,error:expected});
    expect(f.provider).not.toHaveBeenCalled();expect(f.read).not.toHaveBeenCalled();
  });
  it.each([null,{id:target,revision:4},{id:actor.userId,revision:4,emailPending:true},{id:target,revision:4,emailPending:'yes'}])('untrusted prepare result %j is never used',async data=>{
    const f=editFixture();f.rpc.mockImplementation(async name=>name==='get_actor'?{data:actor,error:null}:{data,error:null});
    expect(await f.service.setEmail(f.ctx,edit)).toMatchObject({ok:false,error:{code:'UNAVAILABLE'}});
    expect(f.provider).not.toHaveBeenCalled();
  });
  it('forged owner flag is rejected before prepare',async()=>{
    const f=editFixture();f.rpc.mockResolvedValue({data:{...actor,isOwner:false},error:null});
    expect(await f.service.setEmail(f.ctx,edit)).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
    expect(f.rpc).toHaveBeenCalledTimes(1);expect(f.provider).not.toHaveBeenCalled();
  });
  it.each([null,undefined,{},{...edit,email:null},{...edit,email:7},{...edit,email:'invalid'},{...edit,fullName:' '},{...edit,fullName:7},{...edit,expectedRevision:undefined},{...edit,expectedRevision:0},{...edit,userId:'invalid'},{...edit,extra:true}])('malformed input %j is rejected without throwing',async bad=>{
    const f=editFixture();
    expect(await f.service.setEmail(f.ctx,bad as never)).toMatchObject({ok:false,error:{code:'VALIDATION'}});
    expect(f.state.calls).toEqual([]);expect(f.provider).not.toHaveBeenCalled();
  });
  it.each(['returned','thrown'])('lost Auth response (%s) after commit is Saved and a retry repeats nothing',async kind=>{
    const f=editFixture();
    f.update.mockImplementation(async()=>{f.commit(after);if(kind==='thrown')throw new Error('socket closed');return {error:{message:'network'}};});
    expect(await f.service.setEmail(f.ctx,edit)).toEqual(saved);
    expect(await f.service.setEmail(f.ctx,edit)).toEqual(saved);
    expect(f.update).toHaveBeenCalledTimes(1);
  });
  it('failure before the Auth change leaves everything in place and can be retried',async()=>{
    const f=editFixture();f.update.mockResolvedValueOnce({error:{message:'network'}});
    expect(await f.service.setEmail(f.ctx,edit)).toMatchObject({ok:false,error:{code:'UNAVAILABLE'}});
    expect(f.state).toMatchObject({profile:before,auth:before.email});expect(f.update).toHaveBeenCalledTimes(1);
    expect(await f.service.setEmail(f.ctx,edit)).toEqual(saved);
  });
  it('two edits from one revision commit once and keep login equal to the profile',async()=>{
    const f=editFixture();
    const results=await Promise.all([f.service.setEmail(f.ctx,edit),f.service.setEmail(f.ctx,{...edit,email:'other@example.invalid'})]);
    expect(results.filter(result=>result.ok)).toEqual([saved]);
    expect(f.state.profile.revision).toBe(5);expect(f.state.auth).toBe(f.state.profile.email);
  });
  it('retry after a later edit never overwrites it',async()=>{
    const f=editFixture();
    expect(await f.service.setEmail(f.ctx,edit)).toEqual(saved);
    f.commit({...after,full_name:'עריכה מאוחרת',revision:6});
    expect(await f.service.setEmail(f.ctx,edit)).toMatchObject({ok:false,error:{code:'CONFLICT'}});
    expect(f.state.profile.full_name).toBe('עריכה מאוחרת');expect(f.update).toHaveBeenCalledTimes(1);
  });
  it.each<[string,Profile,unknown,string]>([
    ['another name won',{...after,full_name:'שם אחר'},null,'CONFLICT'],
    ['another email won',{...after,email:'other@example.invalid'},null,'CONFLICT'],
    ['a later revision exists',{...after,revision:6},null,'CONFLICT'],
    ['an edit made Auth roll back',{...before,revision:5},{status:500,message:'Error updating user'},'CONFLICT'],
    ['duplicate email_exists',before,{code:'email_exists'},'CONFLICT'],
    ['duplicate email_address_exists',before,{code:'email_address_exists'},'CONFLICT'],
    ['duplicate user_already_exists',before,{code:'user_already_exists'},'CONFLICT'],
    ['validation_failed',before,{code:'validation_failed'},'VALIDATION'],
    ['email_address_invalid',before,{code:'email_address_invalid'},'VALIDATION'],
    ['rate limit',before,{status:429},'RATE_LIMITED'],
    ['provider rollback',before,{status:500,code:'unexpected_failure',message:'Error updating user'},'UNAVAILABLE'],
    ['no error but no change',before,null,'UNAVAILABLE'],
  ])('%s: revision and receipt decide the result',async(_label,profile,error,code)=>{
    const f=editFixture();f.update.mockImplementation(async()=>{if(profile.revision!==before.revision)f.commit(profile);return {error};});
    const result=await f.service.setEmail(f.ctx,edit);
    expect(result).toMatchObject({ok:false,error:{code}});
    if(code==='VALIDATION')expect(result).toMatchObject({error:{fieldErrors:{email:expect.any(String)}}});
    expect(f.update).toHaveBeenCalledTimes(1);
    expect(f.rpc.mock.calls.map(([name])=>name)).toEqual(['get_actor','prepare_profile_update',...(profile.revision===before.revision?[]:['prepare_profile_update'])]);
  });
  it('drifted account with an unrelated revision bump is never reported as Saved',async()=>{
    const f=editFixture(),drifted={...edit,fullName:before.full_name};
    // The profile already holds the requested email and name while login does not.
    f.state.profile.email=edit.email;
    f.update.mockImplementation(async()=>{f.state.profile.revision++;return {error:{status:500,code:'unexpected_failure',message:'Error updating user'}};});
    expect(await f.service.setEmail(f.ctx,drifted)).toMatchObject({ok:false,error:{code:'CONFLICT'}});
    expect(f.state.auth).toBe(before.email);expect(f.update).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['still pending',{data:{id:target,revision:5,emailPending:true},error:null},'UNAVAILABLE'],
    ['malformed',{data:{id:target,revision:5},error:null},'UNAVAILABLE'],
    ['another profile',{data:{id:actor.userId,revision:5,emailPending:false},error:null},'UNAVAILABLE'],
    ['lost',{data:null,error:{message:'network'}},'UNAVAILABLE'],
    ['unauthenticated',{data:null,error:{message:'UNAUTHENTICATED'}},'UNAUTHENTICATED'],
  ] as const)('receipt replay %s never repeats Auth',async(_label,reply,code)=>{
    const f=editFixture();
    f.update.mockImplementation(async()=>{f.commit(after);f.rpc.mockResolvedValueOnce(reply);return {error:null};});
    expect(await f.service.setEmail(f.ctx,edit)).toMatchObject({ok:false,error:{code}});
    expect(f.update).toHaveBeenCalledTimes(1);
  });
  it.each(['error','empty','thrown'])('unknown outcome when the profile read is %s stays retryable',async kind=>{
    const f=editFixture();
    f.read.mockImplementationOnce(async()=>{if(kind==='thrown')throw new Error('network');return {data:null,error:kind==='error'?{message:'network'}:null};});
    expect(await f.service.setEmail(f.ctx,edit)).toMatchObject({ok:false,error:{code:'UNAVAILABLE'}});
    expect(await f.service.setEmail(f.ctx,edit)).toEqual(saved);expect(f.update).toHaveBeenCalledTimes(1);
  });
  it('admin client failure still reads the outcome',async()=>{
    const f=editFixture();f.provider.mockImplementation(()=>{throw new Error('no configuration');});
    expect(await f.service.setEmail(f.ctx,edit)).toMatchObject({ok:false,error:{code:'UNAVAILABLE'}});
    expect(f.state.calls).toEqual(['prepare_profile_update','read']);
  });
});
