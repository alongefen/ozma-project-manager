import 'server-only';
import { z } from 'zod';
import type { Db, RequestContext, Result } from '@/types/contracts';
import type { Json } from '@/types/database';
import { createPrivilegedClient } from '@/lib/db/clients';
import { failure, rpc } from '@/lib/db/rpc';

// HARD-DELETE (A-44). The database function is the authority (owner only, cancelled/archived only, typed name).
// Order: 1. the function deletes the rows and queues every storage path in ONE transaction;
// 2. this module removes the queued objects through the Storage API; 3. it acknowledges them.
// If step 2 or 3 fails, the rows are already gone (so nothing points to a missing file) and the paths stay queued:
// the result says so (storagePending > 0) and the next permanent delete retries them. Nothing is silent.
export const KINDS = ['project', 'document', 'entry', 'transaction'] as const;
export type Kind = (typeof KINDS)[number];
export const HardDeleteInput = z.object({ kind: z.enum(KINDS), id: z.string().uuid(), confirmName: z.string().max(300).optional() }).strict();
export const PreviewInput = z.object({ kind: z.enum(KINDS), id: z.string().uuid() }).strict();
export type Preview = { kind: Kind; name: string | null; confirmName: string | null; requiresName: boolean; eligible: boolean; counts: Record<string, number> };
export type Deleted = { deleted: Record<string, number>; storagePending: number };
type Queued = { id: number; bucket: string; path: string };
const BATCH = 100;

type Privileged = Pick<Db, 'rpc' | 'storage'>;

/** Removes every queued storage object and acknowledges it. Returns how many stay queued. Never throws. */
export async function drainStorageQueue(privileged: () => Privileged = createPrivilegedClient): Promise<number> {
  try {
    const service = privileged();
    const pending = await service.rpc('system_storage_pending', { input: {} });
    if (pending.error) return -1;
    const rows = (pending.data ?? []) as Queued[];
    const byBucket = new Map<string, Queued[]>();
    for (const row of rows) byBucket.set(row.bucket, [...(byBucket.get(row.bucket) ?? []), row]);
    const done: number[] = [];
    for (const [bucket, items] of byBucket) {
      for (let i = 0; i < items.length; i += BATCH) {
        const batch = items.slice(i, i + BATCH);
        const removed = await service.storage.from(bucket).remove(batch.map(item => item.path));
        if (removed.error) continue;
        done.push(...batch.map(item => item.id));
      }
    }
    if (done.length > 0) {
      const ack = await service.rpc('system_storage_done', { input: { ids: done } as Json });
      if (ack.error) return rows.length;
    }
    return rows.length - done.length;
  } catch { return -1; }
}

export async function previewHardDelete(ctx: RequestContext, input: unknown): Promise<Result<Preview>> {
  const parsed = PreviewInput.safeParse(input);
  if (!parsed.success) return failure('VALIDATION');
  if (!ctx.actor.isOwner) return failure('FORBIDDEN');
  return rpc<typeof parsed.data, Preview>(ctx, 'hard_delete_preview', parsed.data);
}

export async function hardDelete(ctx: RequestContext, input: unknown, privileged: () => Privileged = createPrivilegedClient): Promise<Result<Deleted>> {
  const parsed = HardDeleteInput.safeParse(input);
  if (!parsed.success) return failure('VALIDATION');
  if (!ctx.actor.isOwner) return failure('FORBIDDEN');
  const { kind, id, confirmName } = parsed.data;
  const result = await rpc<Record<string, string>, { deleted: Record<string, number> }>(ctx, `hard_delete_${kind}`, confirmName === undefined ? { id } : { id, confirmName });
  if (!result.ok) return result;
  const storagePending = await drainStorageQueue(privileged);
  return { ok: true, value: { deleted: result.value.deleted, storagePending: storagePending < 0 ? 1 : storagePending } };
}
