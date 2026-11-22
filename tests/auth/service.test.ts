import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../../src/types/contracts';
vi.mock('server-only', () => ({}));
import { createAuthService } from '../../src/lib/auth/service';
const actor = {userId:'2db95268-54da-42fa-bf62-2648ac3cc579',fullName:'בדיקה',email:'test@example.invalid',isOwner:false};
const session = {access_token:'a.b.c',refresh_token:'fixture-refresh'};
function fixture() {
  const db = {rpc:vi.fn().mockResolvedValue({data:actor,error:null}),auth:{getUser:vi.fn().mockResolvedValue({data:{user:{id:actor.userId}},error:null}),getSession:vi.fn().mockResolvedValue({data:{session},error:null}),setSession:vi.fn().mockResolvedValue({data:{session},error:null}),signOut:vi.fn().mockResolvedValue({error:null})}};
  const authClient = {auth:{signInWithPassword:vi.fn().mockResolvedValue({data:{session,user:{id:actor.userId}},error:null}),signOut:vi.fn().mockResolvedValue({error:null})}};
  const service = createAuthService({db:db as unknown as Db,authClient:authClient as unknown as Db});
  return {db,authClient,service};
}
beforeEach(()=>vi.clearAllMocks());
describe('כניסה וסשן דרך שירות השרת',()=>{
  it('normalizes email and derives actor through user-context RPC',async()=>{
    const f=fixture();
    expect(await f.service.signIn({email:' TEST@EXAMPLE.INVALID ',password:'fixture-password'})).toEqual({ok:true,value:actor});
    expect(f.authClient.auth.signInWithPassword).toHaveBeenCalledWith({email:'test@example.invalid',password:'fixture-password'});
    expect(f.db.rpc).toHaveBeenCalledWith('get_actor',{input:{}});
    expect(JSON.stringify(f.db.rpc.mock.calls)).not.toContain('fixture-password');
  });
  it('never accepts a valid provider session without an active application profile',async()=>{
    const f=fixture();f.db.rpc.mockResolvedValue({data:null,error:null});
    expect(await f.service.signIn({email:actor.email,password:'fixture-password'})).toMatchObject({ok:false,error:{code:'UNAUTHENTICATED'}});
    expect(f.db.auth.signOut).toHaveBeenCalled();
  });
  it('provider throttling is returned as a typed rate-limit failure',async()=>{
    const f=fixture();f.authClient.auth.signInWithPassword.mockResolvedValue({data:{session:null,user:null},error:{status:429,code:'over_request_rate_limit',message:'provider secret fixture'}} as never);
    const result=await f.service.signIn({email:actor.email,password:'fixture-password'});
    expect(result).toMatchObject({ok:false,error:{code:'RATE_LIMITED'}});
    expect(JSON.stringify(result)).not.toContain('provider secret');
  });
  it('getContext rejects a revoked session even when cookies remain',async()=>{
    const f=fixture();f.db.rpc.mockResolvedValue({data:null,error:null});
    expect(await f.service.getContext()).toMatchObject({ok:false,error:{code:'UNAUTHENTICATED'}});
  });
  it('signOut revokes only the current session and reports failure',async()=>{
    const f=fixture();expect(await f.service.signOut()).toEqual({ok:true,value:null});
    expect(f.db.auth.signOut).toHaveBeenCalledWith({scope:'local'});
    f.db.auth.signOut.mockResolvedValue({error:{message:'network'}} as never);
    expect(await f.service.signOut()).toMatchObject({ok:false,error:{code:'UNAVAILABLE'}});
  });
});
