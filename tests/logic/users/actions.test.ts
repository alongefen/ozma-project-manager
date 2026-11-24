import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestContext } from '../../../src/types/contracts';
vi.mock('server-only',()=>({}));
const f=vi.hoisted(()=>({setOwnerLevel:vi.fn(),getContext:vi.fn(),createPlatform:vi.fn(),createUser:vi.fn(),setMembership:vi.fn()}));
vi.mock('../../../src/lib/auth/platform',()=>({createPlatform:f.createPlatform}));
vi.mock('../../../src/features/users/logic/commands',async importOriginal=>({...await importOriginal<object>(),createOwnerLevelCommand:()=>({setOwnerLevel:f.setOwnerLevel})}));
vi.mock('../../../src/features/users/logic/index',()=>({createUsersApi:()=>({createUser:f.createUser,setMembership:f.setMembership})}));
import { createUser, setMembership, setOwnerLevel } from '../../../src/features/users/logic/actions';
const id='711795f0-48c2-4c8f-b470-dd0c95a2aaf7';
const ctx={actor:{userId:id,isOwner:false},db:{},today:'2026-11-22'} as RequestContext;
beforeEach(()=>{
  vi.clearAllMocks();f.createPlatform.mockResolvedValue({auth:{getContext:f.getContext}});
  f.getContext.mockResolvedValue({ok:true,value:ctx});
  f.createUser.mockResolvedValue({ok:true,value:{id,revision:1}});
  f.setMembership.mockResolvedValue({ok:true,value:{revision:1,financeAccess:false}});
});
describe('Users server actions',()=>{
  it('derives context on the server and validates the create request',async()=>{
    const input={requestId:id,email:'person@example.invalid',fullName:'  שם בדוי  ',password:'example-only-password'};
    expect(await createUser(input)).toMatchObject({ok:true});
    expect(f.getContext).toHaveBeenCalledOnce();
    expect(f.createUser).toHaveBeenCalledWith(ctx,{...input,fullName:'שם בדוי'});
  });
  it('refuses injected identity fields without running a command',async()=>{
    const input={requestId:id,email:'person@example.invalid',fullName:'בדוי',password:'example-only-password',actor:{isOwner:true}};
    expect(await createUser(input)).toMatchObject({ok:false,error:{code:'VALIDATION'}});
    expect(f.createUser).not.toHaveBeenCalled();
  });
  it('returns unauthenticated context failures without executing a command',async()=>{
    const failure={ok:false,error:{code:'UNAUTHENTICATED',message:'יש להתחבר'}};
    f.getContext.mockResolvedValue(failure);
    expect(await setMembership({userId:id,projectId:id,role:'manager',expectedRevision:null})).toEqual(failure);
    expect(f.setMembership).not.toHaveBeenCalled();
  });
  it('rejects malformed revision and invalid role',async()=>{
    expect(await setMembership({userId:id,projectId:id,role:'owner',expectedRevision:0} as never)).toMatchObject({ok:false,error:{code:'VALIDATION'}});
    expect(f.setMembership).not.toHaveBeenCalled();
  });
  it('sanitizes unexpected failures into a Result',async()=>{
    f.createPlatform.mockRejectedValue(new Error('private provider details'));
    const result=await createUser({requestId:id,email:'person@example.invalid',fullName:'בדוי',password:'example-only-password'});
    expect(result).toMatchObject({ok:false,error:{code:'UNAVAILABLE'}});
    expect(JSON.stringify(result)).not.toContain('provider');
  });
  it('setOwnerLevel derives context on the server, validates input and refuses extra fields',async()=>{
    f.setOwnerLevel.mockResolvedValue({ok:true,value:{id,revision:2}});
    const input={userId:id,enabled:true,expectedRevision:1};
    expect(await setOwnerLevel(input)).toMatchObject({ok:true});
    expect(f.setOwnerLevel).toHaveBeenCalledWith(ctx,input);
    f.setOwnerLevel.mockClear();
    expect(await setOwnerLevel({...input,actor:{isOwner:true}} as never)).toMatchObject({ok:false,error:{code:'VALIDATION'}});
    expect(await setOwnerLevel({...input,enabled:'yes'} as never)).toMatchObject({ok:false,error:{code:'VALIDATION'}});
    expect(f.setOwnerLevel).not.toHaveBeenCalled();
  });
});
