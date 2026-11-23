import { describe, expect, it, vi } from 'vitest';
import type { Db, Platform, RequestContext } from '../../../src/types/contracts';
vi.mock('server-only', () => ({}));
import { createUsersApi } from '../../../src/features/users/logic';
import { format } from '../../../src/lib/format';
import { fetchAll } from '../../../src/lib/db/rpc';

const id = '711795f0-48c2-4c8f-b470-dd0c95a2aaf7';
const projectId = '95820c6e-e329-4c37-a6a3-cd4d391be79c';
const requestId = '6d512814-364e-4129-9c18-7ca24c12e847';
const profile = { id, full_name: 'אדם בדוי', email: 'person@example.invalid', is_owner: false, is_active: true, revision: 3 };
const ok = <T>(value:T) => ({ok:true as const,value});
const denied = {ok:false as const,error:{code:'FORBIDDEN' as const,message:'אין הרשאה'}};
function fixture() {
  const db = {from:vi.fn(() => {
    const query:Record<string,unknown> = {};
    for(const name of ['select','eq','order','in','range']) query[name]=vi.fn(()=>query);
    query.maybeSingle=vi.fn(async()=>({data:profile,error:null}));
    query.single=query.maybeSingle;
    query.then=(resolve:(v:unknown)=>unknown)=>Promise.resolve({data:[profile],error:null}).then(resolve);
    return query;
  })} as unknown as Db;
  const ctx:RequestContext={actor:{userId:id,fullName:'בעלים',email:'owner@example.invalid',isOwner:true},db,today:'2026-11-22'};
  const rpc=vi.fn<(ctx:RequestContext,name:string,input:unknown)=>Promise<unknown>>().mockResolvedValue(ok({id,revision:4}));
  const authAdmin={createUser:vi.fn<(ctx:RequestContext,input:unknown)=>Promise<unknown>>().mockResolvedValue(ok({userId:id})),setPassword:vi.fn<(ctx:RequestContext,input:unknown)=>Promise<unknown>>().mockResolvedValue(ok(null)),setEmail:vi.fn<(ctx:RequestContext,input:unknown)=>Promise<unknown>>().mockResolvedValue(ok(null))};
  const requireOwner=vi.fn(async()=>ok(null));
  const platform={rpc,fetchAll,format,authAdmin,permissions:{requireOwner,forProject:vi.fn()},auth:{},storage:{},audit:{}} as unknown as Platform;
  return {ctx,rpc,authAdmin,requireOwner,api:createUsersApi(platform)};
}

describe('UsersApi command orchestration',()=>{
  it('uses the managed creation receipt and never forwards a password to RPC',async()=>{
    const f=fixture();
    const input={requestId,email:'person@example.invalid',fullName:'אדם בדוי',password:'example-only-password'};
    expect(await f.api.createUser(f.ctx,input)).toMatchObject({ok:true,value:{id,revision:expect.any(Number)}});
    expect(f.authAdmin.createUser).toHaveBeenCalledWith(f.ctx,input);
    expect(JSON.stringify(f.rpc.mock.calls)).not.toContain(input.password);
  });
  it('keeps requestId unchanged on creation retry and propagates Auth failure',async()=>{
    const f=fixture();const input={requestId,email:'person@example.invalid',fullName:'אדם בדוי',password:'example-only-password'};
    f.authAdmin.createUser.mockResolvedValueOnce(denied as never);
    expect(await f.api.createUser(f.ctx,input)).toEqual(denied);
    await f.api.createUser(f.ctx,input);
    expect(f.authAdmin.createUser.mock.calls.map(([,v])=>(v as typeof input).requestId)).toEqual([requestId,requestId]);
  });
  it.each(['createUser','resetPassword','updateUser','setUserActive','setMembership','removeMembership','setFinanceAccess'] as const)('denies %s before side effects when live ownership is rejected',async(method)=>{
    const f=fixture();f.requireOwner.mockResolvedValue(denied as never);
    const inputs={createUser:{requestId,email:profile.email,fullName:profile.full_name,password:'example-only-password'},resetPassword:{id,password:'example-only-password'},updateUser:{id,expectedRevision:3,email:profile.email,fullName:profile.full_name},setUserActive:{id,expectedRevision:3,active:false},setMembership:{userId:id,projectId,role:'worker',expectedRevision:null},removeMembership:{userId:id,projectId,expectedRevision:1},setFinanceAccess:{userId:id,projectId,enabled:true,expectedRevision:1}};
    const call=f.api[method] as (ctx:RequestContext,input:unknown)=>Promise<unknown>;
    expect(await call(f.ctx,inputs[method])).toEqual(denied);
    expect(f.rpc).not.toHaveBeenCalled();
    expect(f.authAdmin.createUser).not.toHaveBeenCalled();expect(f.authAdmin.setEmail).not.toHaveBeenCalled();expect(f.authAdmin.setPassword).not.toHaveBeenCalled();
  });
  it('reset delegates password change and session revocation to AuthAdmin',async()=>{
    const f=fixture();const password='example-only-password';
    expect(await f.api.resetPassword(f.ctx,{id,password})).toEqual(ok(null));
    expect(f.authAdmin.setPassword).toHaveBeenCalledWith(f.ctx,{userId:id,password});
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('preserves membership revisions and finance flags returned by the database',async()=>{
    const f=fixture();f.rpc.mockResolvedValue(ok({revision:7,financeAccess:false}) as never);
    const input={userId:id,projectId,role:'worker' as const,expectedRevision:6};
    expect(await f.api.setMembership(f.ctx,input)).toEqual(ok({revision:7,financeAccess:false}));
    expect(f.rpc).toHaveBeenCalledWith(f.ctx,'set_membership',input);
  });
  it('does not retry a stale revision or turn conflict into success',async()=>{
    const f=fixture();const conflict={ok:false as const,error:{code:'CONFLICT' as const,message:'יש לרענן'}};
    f.rpc.mockResolvedValue(conflict as never);
    expect(await f.api.setUserActive(f.ctx,{id,expectedRevision:2,active:false})).toEqual(conflict);
    expect(f.rpc).toHaveBeenCalledTimes(1);
  });
  it('delegates name and email edits with the client revision to AuthAdmin.setEmail, with no second write',async()=>{
    const f=fixture();f.authAdmin.setEmail.mockResolvedValue(ok({id,revision:4}));
    expect(await f.api.updateUser(f.ctx,{id,expectedRevision:3,fullName:'שינוי',email:'changed@example.invalid'})).toEqual(ok({id,revision:4}));
    expect(f.authAdmin.setEmail).toHaveBeenCalledWith(f.ctx,{userId:id,expectedRevision:3,fullName:'שינוי',email:'changed@example.invalid'});
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('returns CONFLICT from setEmail without retrying',async()=>{
    const f=fixture();const conflict={ok:false as const,error:{code:'CONFLICT' as const,message:'יש לרענן'}};
    f.authAdmin.setEmail.mockResolvedValue(conflict);
    expect(await f.api.updateUser(f.ctx,{id,expectedRevision:2,fullName:'שינוי',email:'changed@example.invalid'})).toEqual(conflict);
    expect(f.authAdmin.setEmail).toHaveBeenCalledTimes(1);
  });
});
