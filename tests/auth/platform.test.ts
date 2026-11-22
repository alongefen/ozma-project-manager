import { describe, expect, it, vi } from 'vitest';
import type { Db, RequestContext } from '../../src/types/contracts';
vi.mock('server-only', () => ({}));
import { fetchAll, rpc, mapError } from '../../src/lib/db/rpc';
import { format } from '../../src/lib/format';
import { permissions } from '../../src/lib/permissions';

const actor = { userId: '2db95268-54da-42fa-bf62-2648ac3cc579', fullName: 'בדיקה', email: 'test@example.invalid', isOwner: false };
function context(call: ReturnType<typeof vi.fn>, owner = false): RequestContext {
  return { actor: { ...actor, isOwner: owner }, db: { rpc: call } as unknown as Db, today: '2026-11-22' };
}

describe('תשתית שרת: דפדוף, שגיאות, הרשאה ופורמט', () => {
  it('validation preserves the database field using a safe Hebrew message',()=>{
    expect(mapError({message:'VALIDATION',details:JSON.stringify({code:'VALIDATION',field:'email'})})).toMatchObject({code:'VALIDATION',fieldErrors:{email:expect.stringMatching(/[א-ת]/)}});
    expect(mapError({message:'VALIDATION',details:'provider password=fixture'})).toMatchObject({code:'VALIDATION'});
    expect(JSON.stringify(mapError({message:'VALIDATION',details:'provider password=fixture'}))).not.toContain('password=fixture');
  });

  it('fetchAll reads beyond the Data API 1000-row page without duplication', async () => {
    const rows = Array.from({length: 2051}, (_, id) => ({id}));
    const page = vi.fn(async (from: number, to: number) => rows.slice(from, to + 1));
    expect(await fetchAll(page)).toEqual(rows);
    expect(page.mock.calls.length).toBeGreaterThan(1);
  });
  it('fetchAll does not turn a failed later page into a partial successful list', async () => {
    const page = vi.fn(async (from: number) => { if (from > 0) throw new Error('network'); return Array.from({length: 1000}, (_, id) => id); });
    await expect(fetchAll(page)).rejects.toThrow('network');
  });
  it('RPC keeps errors typed and does not expose provider details', async () => {
    const call = vi.fn().mockResolvedValue({data:null,error:{message:'internal connection password=fixture',code:'XX000'}});
    const result = await rpc(context(call), 'get_actor', {});
    expect(result).toMatchObject({ok:false,error:{code:'UNAVAILABLE'}});
    expect(JSON.stringify(result)).not.toContain('password=fixture');
  });
  it.each(['FORBIDDEN','NOT_FOUND','CONFLICT','PROJECT_READ_ONLY','UNAUTHENTICATED','LIMIT'])('RPC preserves %s', async (code) => {
    const call = vi.fn().mockResolvedValue({data:null,error:{message:code,code:'P0001'}});
    expect(await rpc(context(call), 'get_actor', {})).toMatchObject({ok:false,error:{code}});
  });
  it('owner authorization rechecks database identity rather than trusting ctx.actor', async () => {
    const call = vi.fn().mockResolvedValue({data:actor,error:null});
    expect(await permissions.requireOwner(context(call, true), {})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
    expect(call).toHaveBeenCalledWith('get_actor', {input:{}});
  });
  it('revoked or disabled sessions cannot use an old owner context', async () => {
    const call = vi.fn().mockResolvedValue({data:null,error:null});
    expect(await permissions.requireOwner(context(call, true), {})).toMatchObject({ok:false,error:{code:'UNAUTHENTICATED'}});
  });
  it('project permissions come from the requested project via user RPC', async () => {
    const flags = {view:true,viewFinance:false,writeFinance:false};
    const call = vi.fn().mockResolvedValue({data:flags,error:null});
    const projectId = '6d54739e-32cf-44fb-9c7f-f26aef663d88';
    expect(await permissions.forProject(context(call), {projectId})).toMatchObject({ok:true,value:flags});
    expect(call).toHaveBeenCalledWith('project_permissions', {input:{projectId}});
  });
  it('date-only values do not shift at timezone boundaries', () => {
    expect(format.date('2026-01-02')).toBe('02.01.2026');
    expect(format.todayInIsrael(new Date('2026-01-01T22:30:00Z'))).toBe('2026-01-02');
    expect(format.todayInIsrael(new Date('2026-07-01T21:30:00Z'))).toBe('2026-07-02');
    expect(format.dateTime('2026-01-01T22:30:00Z')).toContain('00:30');
  });
  it('search normalizes whitespace, case and Hebrew/curly quotation marks', () => {
    expect(format.searchKey('  TEST   בע״מ  ')).toBe(format.searchKey('test בע"מ'));
    expect(format.searchKey('א׳ב')).toBe(format.searchKey("א'ב"));
    expect(format.searchKey('a’b')).toBe(format.searchKey("a'b"));
  });
  it('money preserves negative integer agorot and grouping', () => {
    const result = format.money(-123456);
    expect(result).toContain('1,234.56');
    expect(result).toContain('₪');
    expect(result).toContain('-');
  });
});
