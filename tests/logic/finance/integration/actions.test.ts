import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
const mocks=vi.hoisted(()=>({platform:vi.fn(),context:vi.fn(),operation:vi.fn()}));
vi.mock('@/lib/auth/platform',()=>({createPlatform:mocks.platform}));
vi.mock('@/features/finance/logic/index',()=>({createFinanceApi:()=>({getBook:mocks.operation,createTransaction:mocks.operation})}));
import { createTransaction, getBook } from '@/features/finance/logic/actions';
const projectId='11111111-1111-4111-8111-111111111111';
beforeEach(()=>{vi.clearAllMocks();mocks.platform.mockResolvedValue({auth:{getContext:mocks.context}});});
describe('מעטפת פעולות הכספים',()=>{
  it('מפיק הקשר שרת ולא מקבל זהות מהלקוח',async()=>{
    const context={actor:{userId:'server'},db:{},today:'2026-11-22'};
    mocks.context.mockResolvedValue({ok:true,value:context});mocks.operation.mockResolvedValue({ok:true,value:null});
    const input={projectId,filter:{period:'all' as const}};
    await getBook(input);
    expect(mocks.operation).toHaveBeenCalledWith(context,input);
  });
  it('סשן חסר נדחה לפני הפעלת פיצ׳ר',async()=>{
    mocks.context.mockResolvedValue({ok:false,error:{code:'UNAUTHENTICATED',message:'בדיקה'}});
    expect(await getBook({projectId,filter:{period:'all'}})).toMatchObject({ok:false,error:{code:'UNAUTHENTICATED'}});
    expect(mocks.operation).not.toHaveBeenCalled();
  });
  it('כשל פנימי אינו חושף פרטי ספק',async()=>{
    mocks.platform.mockRejectedValue(new Error('secret-provider-detail'));
    const result=await createTransaction({projectId,requestId:projectId,fields:{year:2026,month:1,day:null,kind:'income',amount:1,details:'בדוי'}});
    expect(result).toMatchObject({ok:false,error:{code:'UNAVAILABLE'}});
    expect(JSON.stringify(result)).not.toContain('secret-provider-detail');
  });
});
