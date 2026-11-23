import {describe,expect,it,vi} from 'vitest';
import type {Db,Platform,RequestContext} from '../../../src/types/contracts';
vi.mock('server-only',()=>({}));
import {createUsersApi} from '../../../src/features/users/logic';
import {fetchAll} from '../../../src/lib/db/rpc';
import {format} from '../../../src/lib/format';
const person='711795f0-48c2-4c8f-b470-dd0c95a2aaf7';
const project='95820c6e-e329-4c37-a6a3-cd4d391be79c';
function fixture(count=1) {
  const profiles=Array.from({length:count},(_,i)=>({id:i===0?person:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,full_name:i===0?'אב״ג  בדוי':`שם ${i}`,email:`p${i}@example.invalid`,is_owner:false,is_active:true,revision:2}));
  const tables:Record<string,Record<string,unknown>[]>= {profiles,memberships:[{user_id:person,project_id:project,role:'manager',finance_access:true,revision:4}],projects:[{id:project,name:'פרויקט בדוי'}]};
  const ranges:unknown[]=[];
  let failureAt=-1;
  const db={from:vi.fn((table:string)=>{
    let rows=tables[table]??[];let from=0;let to=999;
    const query={select:vi.fn(()=>query),order:vi.fn(()=>query),eq:vi.fn((key:string,value:unknown)=>{rows=rows.filter(row=>row[key]===value);return query;}),in:vi.fn((key:string,values:unknown[])=>{rows=rows.filter(row=>values.includes(row[key]));return query;}),range:vi.fn((start:number,end:number)=>{from=start;to=end;ranges.push([table,start,end]);return query;}),maybeSingle:vi.fn(async()=>({data:rows[0]??null,error:null})),then:(resolve:(v:unknown)=>unknown)=>Promise.resolve(from===failureAt?{data:null,error:{message:'provider secret detail'}}:{data:rows.slice(from,to+1),error:null}).then(resolve)};
    return query;
  })} as unknown as Db;
  const ctx={actor:{userId:person,fullName:'בעלים',email:'owner@example.invalid',isOwner:true},db,today:'2026-11-22'} as RequestContext;
  const requireOwner=vi.fn(async()=>({ok:true as const,value:null}));
  const platform={fetchAll,format,permissions:{requireOwner},rpc:vi.fn(),authAdmin:{}} as unknown as Platform;
  return {ctx,api:createUsersApi(platform),requireOwner,ranges,setFailure:(start:number)=>{failureAt=start;}};
}
describe('UsersApi owner queries',()=>{
  it('reads beyond the first Data API page, joins assignments and normalizes Hebrew search',async()=>{
    const f=fixture(1001);
    const all=await f.api.listUsers(f.ctx,{});expect(all).toMatchObject({ok:true});
    if(all.ok) expect(all.value).toHaveLength(1001);
    expect(f.ranges).toContainEqual(['profiles',1000,1999]);
    expect(await f.api.listUsers(f.ctx,{search:'  אב"ג בדוי '})).toMatchObject({ok:true,value:[{id:person,assignments:[{projectId:project,projectName:'פרויקט בדוי',role:'manager',financeAccess:true,revision:4}]}]});
  });
  it('does not return partial success after a later page fails or expose provider details',async()=>{
    const f=fixture(1001);f.setFailure(1000);
    const result=await f.api.listUsers(f.ctx,{});
    expect(result).toMatchObject({ok:false,error:{code:'UNAVAILABLE'}});expect(JSON.stringify(result)).not.toContain('provider');
  });
  it('returns not found for an absent profile',async()=>{
    const f=fixture();
    expect(await f.api.getUser(f.ctx,{id:'00000000-0000-4000-8000-000000000000'})).toMatchObject({ok:false,error:{code:'NOT_FOUND'}});
  });
  it('builds member rows from the requested project and profile fields',async()=>{
    const f=fixture();
    expect(await f.api.listProjectMembers(f.ctx,{projectId:project})).toEqual({ok:true,value:[{userId:person,fullName:'אב״ג  בדוי',role:'manager',financeAccess:true,isActive:true,revision:4}]});
  });
  it.each(['listUsers','getUser','listProjectMembers'] as const)('checks live ownership before %s reads despite a forged owner actor',async(method)=>{
    const f=fixture();const failure={ok:false as const,error:{code:'FORBIDDEN' as const,message:'אין הרשאה'}};
    f.requireOwner.mockResolvedValue(failure as never);
    const input={listUsers:{},getUser:{id:person},listProjectMembers:{projectId:project}};
    const call=f.api[method] as (ctx:RequestContext,input:unknown)=>Promise<unknown>;
    expect(await call(f.ctx,input[method])).toEqual(failure);expect(f.ctx.db.from).not.toHaveBeenCalled();
  });
});
