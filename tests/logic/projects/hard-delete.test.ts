import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestContext } from '../../../src/types/contracts';
vi.mock('server-only', () => ({}));
const rpcMock = vi.hoisted(() => vi.fn());
vi.mock('../../../src/lib/db/rpc', async () => ({ ...(await vi.importActual<object>('../../../src/lib/db/rpc')), rpc: rpcMock }));
vi.mock('../../../src/lib/db/clients', () => ({ createPrivilegedClient: vi.fn() }));
import { drainStorageQueue, hardDelete, previewHardDelete } from '../../../src/features/projects/logic/hard-delete';

const owner = { actor: { userId: randomUUID(), fullName: 'בדוי', email: 'o@example.invalid', isOwner: true }, db: {}, today: '2026-11-24' } as RequestContext;
const manager = { ...owner, actor: { ...owner.actor, isOwner: false } } as RequestContext;
const id = randomUUID();

function service(queue: { id: number; bucket: string; path: string }[], failBucket?: string) {
  const calls: string[] = [];
  const removed: string[] = [];
  const client = {
    rpc: vi.fn(async (name: string, args: { input: { ids?: number[] } }) => {
      calls.push(name);
      if (name === 'system_storage_pending') return { data: queue, error: null };
      return { data: { acknowledged: args.input.ids?.length }, error: null };
    }),
    storage: { from: (bucket: string) => ({ remove: async (paths: string[]) => { calls.push(`remove:${bucket}`); if (bucket === failBucket) return { data: null, error: { message: 'x' } }; removed.push(...paths); return { data: [], error: null }; } }) },
  };
  return { client: client as never, calls, removed };
}

beforeEach(() => { rpcMock.mockReset(); });

describe('hardDelete (HARD-DELETE, A-44)', () => {
  it('a non-owner never reaches the database', async () => {
    expect(await hardDelete(manager, { kind: 'project', id, confirmName: 'x' })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(await previewHardDelete(manager, { kind: 'project', id })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(rpcMock).not.toHaveBeenCalled();
  });
  it('rejects unknown kinds, bad ids and extra fields', async () => {
    for (const input of [{ kind: 'user', id }, { kind: 'project', id: 'nope' }, { kind: 'project', id, extra: 1 }, null]) {
      expect(await hardDelete(owner, input)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    }
    expect(rpcMock).not.toHaveBeenCalled();
  });
  it('deletes rows first, then removes the queued objects and acknowledges exactly those', async () => {
    rpcMock.mockResolvedValue({ ok: true, value: { deleted: { files: 2 } } });
    const s = service([{ id: 1, bucket: 'originals', path: 'p/a' }, { id: 2, bucket: 'display', path: 'p/a.jpg' }]);
    const r = await hardDelete(owner, { kind: 'project', id, confirmName: 'שם' }, () => s.client);
    expect(rpcMock).toHaveBeenCalledWith(owner, 'hard_delete_project', { id, confirmName: 'שם' });
    expect(r).toEqual({ ok: true, value: { deleted: { files: 2 }, storagePending: 0 } });
    expect(s.calls).toEqual(['system_storage_pending', 'remove:originals', 'remove:display', 'system_storage_done']);
    expect(s.removed.sort()).toEqual(['p/a', 'p/a.jpg']);
  });
  it('a storage failure is reported, the failed paths stay queued (never acknowledged)', async () => {
    rpcMock.mockResolvedValue({ ok: true, value: { deleted: { files: 2 } } });
    const s = service([{ id: 1, bucket: 'originals', path: 'p/a' }, { id: 2, bucket: 'display', path: 'p/a.jpg' }], 'display');
    const r = await hardDelete(owner, { kind: 'document', id, confirmName: 'a.pdf' }, () => s.client);
    expect(r).toEqual({ ok: true, value: { deleted: { files: 2 }, storagePending: 1 } });
    const ack = (s.client as { rpc: ReturnType<typeof vi.fn> }).rpc.mock.calls.find(c => c[0] === 'system_storage_done');
    expect(ack?.[1]).toEqual({ input: { ids: [1] } });
  });
  it('a database refusal is returned as is and storage is not touched', async () => {
    rpcMock.mockResolvedValue({ ok: false, error: { code: 'CONFLICT', message: 'x' } });
    const s = service([]);
    expect(await hardDelete(owner, { kind: 'transaction', id }, () => s.client)).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
    expect(s.calls).toEqual([]);
  });
  it('an unreachable queue never throws and counts as pending', async () => {
    expect(await drainStorageQueue(() => { throw new Error('down'); })).toBe(-1);
  });
});
